package com.runmil.game;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * RUN MIL! two-phone link (1 VS 1).  Uses Google Nearby Connections: it finds the other phone and connects over Bluetooth,
 * and switches to Wi-Fi Direct by itself when it needs more speed.  No internet is needed.
 * JS side: Capacitor.Plugins.RunMilNearby  start({role:"host"|"guest", name}), connect({id}), send({data}), stop()
 * events: found {id,name}  lost {id}  connected {id,name}  message {data}  closed {}  failure {message}
 */
@CapacitorPlugin(name = "RunMilNearby")
public class NearbyPlugin extends Plugin {
    private static final String SERVICE_ID = "com.runmil.game.versus";
    private static final int PERM_CODE = 7711;
    static NearbyPlugin current;

    private ConnectionsClient client;
    private String peer;                                           // the connected endpoint id (null when not connected)
    private String myName = "";
    private boolean advertising, discovering;
    private final Map<String, String> pendingNames = new HashMap<>();
    private PluginCall waitingForPermission;
    private String waitRole;

    @Override
    public void load() {
        current = this;
        client = Nearby.getConnectionsClient(getContext());
    }

    // ---------------- permissions (they differ between Android versions) ----------------
    private String[] needed() {
        List<String> p = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            p.add(Manifest.permission.BLUETOOTH_ADVERTISE);
            p.add(Manifest.permission.BLUETOOTH_CONNECT);
            p.add(Manifest.permission.BLUETOOTH_SCAN);
            if (Build.VERSION.SDK_INT >= 33) p.add("android.permission.NEARBY_WIFI_DEVICES");
        }
        p.add(Manifest.permission.ACCESS_COARSE_LOCATION);          // Nearby asks for location on every Android version
        p.add(Manifest.permission.ACCESS_FINE_LOCATION);
        return p.toArray(new String[0]);
    }

    private String[] missing() {
        List<String> m = new ArrayList<>();
        for (String s : needed()) {
            if (ContextCompat.checkSelfPermission(getContext(), s) != PackageManager.PERMISSION_GRANTED) m.add(s);
        }
        return m.toArray(new String[0]);
    }

    /** Called by MainActivity when the player answered the permission dialog. */
    static void onPermissionResult(int code, int[] results) {
        if (code != PERM_CODE || current == null) return;
        NearbyPlugin pl = current;
        PluginCall call = pl.waitingForPermission;
        pl.waitingForPermission = null;
        if (call == null) return;
        boolean ok = results.length > 0;
        for (String m : pl.missing()) if (!Manifest.permission.ACCESS_FINE_LOCATION.equals(m)) ok = false;   // "approximate location" is enough
        if (ok) pl.begin(call, pl.waitRole);
        else call.reject("Bluetooth / nearby permission was not allowed");
    }

    // ---------------- JS methods ----------------
    @PluginMethod
    public void start(PluginCall call) {
        String role = call.getString("role", "guest");
        myName = call.getString("name", "RUNMIL");
        String[] miss = missing();
        if (miss.length == 0) { begin(call, role); return; }
        waitingForPermission = call;
        waitRole = role;
        ActivityCompat.requestPermissions(getActivity(), miss, PERM_CODE);
    }

    private void begin(final PluginCall call, String role) {
        stopAll(false);
        if ("host".equals(role)) {
            AdvertisingOptions o = new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_POINT_TO_POINT).build();
            client.startAdvertising(myName, SERVICE_ID, lifecycle, o)
                .addOnSuccessListener(v -> { advertising = true; call.resolve(); })
                .addOnFailureListener(e -> call.reject("Could not host: " + e.getMessage()));
        } else {
            DiscoveryOptions o = new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_POINT_TO_POINT).build();
            client.startDiscovery(SERVICE_ID, discovery, o)
                .addOnSuccessListener(v -> { discovering = true; call.resolve(); })
                .addOnFailureListener(e -> call.reject("Could not search: " + e.getMessage()));
        }
    }

    @PluginMethod
    public void connect(final PluginCall call) {
        String id = call.getString("id");
        if (id == null) { call.reject("No device"); return; }
        client.requestConnection(myName, id, lifecycle)
            .addOnSuccessListener(v -> call.resolve())
            .addOnFailureListener(e -> call.reject("Could not connect: " + e.getMessage()));
    }

    @PluginMethod
    public void send(PluginCall call) {
        String data = call.getString("data");
        if (peer == null || data == null) { call.resolve(); return; }
        client.sendPayload(peer, Payload.fromBytes(data.getBytes(StandardCharsets.UTF_8)));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAll(true);
        call.resolve();
    }

    private void stopAll(boolean disconnect) {
        if (advertising) { client.stopAdvertising(); advertising = false; }
        if (discovering) { client.stopDiscovery(); discovering = false; }
        if (disconnect) {
            if (peer != null) client.disconnectFromEndpoint(peer);
            client.stopAllEndpoints();
            peer = null;
        }
        pendingNames.clear();
    }

    @Override
    protected void handleOnDestroy() {
        if (client != null) { client.stopAllEndpoints(); client.stopAdvertising(); client.stopDiscovery(); }
    }

    // ---------------- Nearby callbacks ----------------
    private final EndpointDiscoveryCallback discovery = new EndpointDiscoveryCallback() {
        @Override
        public void onEndpointFound(String id, DiscoveredEndpointInfo info) {
            JSObject o = new JSObject();
            o.put("id", id);
            o.put("name", info.getEndpointName());
            notifyListeners("found", o);
        }

        @Override
        public void onEndpointLost(String id) {
            JSObject o = new JSObject();
            o.put("id", id);
            notifyListeners("lost", o);
        }
    };

    private final ConnectionLifecycleCallback lifecycle = new ConnectionLifecycleCallback() {
        @Override
        public void onConnectionInitiated(String id, ConnectionInfo info) {
            pendingNames.put(id, info.getEndpointName());
            client.acceptConnection(id, payloads);
        }

        @Override
        public void onConnectionResult(String id, ConnectionResolution result) {
            if (result.getStatus().getStatusCode() == ConnectionsStatusCodes.STATUS_OK) {
                peer = id;
                if (advertising) { client.stopAdvertising(); advertising = false; }
                if (discovering) { client.stopDiscovery(); discovering = false; }
                JSObject o = new JSObject();
                o.put("id", id);
                o.put("name", pendingNames.get(id));
                notifyListeners("connected", o);
            } else {
                JSObject o = new JSObject();
                o.put("message", "The other phone refused or the link failed");
                notifyListeners("failure", o);
            }
        }

        @Override
        public void onDisconnected(String id) {
            if (id.equals(peer)) peer = null;
            notifyListeners("closed", new JSObject());
        }
    };

    private final PayloadCallback payloads = new PayloadCallback() {
        @Override
        public void onPayloadReceived(String id, Payload payload) {
            byte[] b = payload.asBytes();
            if (b == null) return;
            JSObject o = new JSObject();
            o.put("data", new String(b, StandardCharsets.UTF_8));
            notifyListeners("message", o);
        }

        @Override
        public void onPayloadTransferUpdate(String id, PayloadTransferUpdate update) { }
    };
}
