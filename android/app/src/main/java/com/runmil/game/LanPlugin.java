package com.runmil.game;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.DhcpInfo;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * RUN MIL! two-phone link over the HOST's HOTSPOT (plain TCP, no internet needed).
 *   host : the phone with the Hotspot ON listens on a port.            JS: Capacitor.Plugins.RunMilLan.host()  -> { ips: [...] }
 *   guest: the other phone joins that Wi-Fi and connects to the host.   JS: join({ ip })  (ip empty = the Wi-Fi gateway, which is the host)
 *   send({ data }) sends one line of text, stop() closes everything.
 * events: connected {ip}  message {data}  closed {}  failure {message}
 */
@CapacitorPlugin(name = "RunMilLan")
public class LanPlugin extends Plugin {
    private static final int PORT = 47831;
    private ServerSocket server;
    private Socket sock;
    private OutputStream out;
    private volatile boolean open = false;
    private final ExecutorService sender = Executors.newSingleThreadExecutor();

    // ---------------- host ----------------
    @PluginMethod
    public void host(final PluginCall call) {
        closeAll();
        final JSArray ips = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) ips.put(a.getHostAddress());
                }
            }
        } catch (Exception ignored) { }
        try {
            server = new ServerSocket();
            server.setReuseAddress(true);
            server.bind(new InetSocketAddress(PORT));
        } catch (Exception e) {
            call.reject("Could not start hosting: " + e.getMessage());
            return;
        }
        final ServerSocket ss = server;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Socket s = ss.accept();
                    attach(s);
                } catch (Exception ignored) { /* closed before anybody came */ }
                try { ss.close(); } catch (Exception ignored) { }
            }
        }, "runmil-host").start();
        JSObject r = new JSObject();
        r.put("ips", ips);
        call.resolve(r);
    }

    // ---------------- guest ----------------
    @PluginMethod
    public void join(final PluginCall call) {
        closeAll();
        String ip = call.getString("ip", "");
        if (ip == null) ip = "";
        ip = ip.trim();
        if (ip.isEmpty()) ip = gateway();
        if (ip == null || ip.isEmpty()) {
            call.reject("Not connected to a Wi-Fi network. Join the host's hotspot first");
            return;
        }
        final String host = ip;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Socket s = new Socket();
                    bindToWifi(s);
                    s.connect(new InetSocketAddress(host, PORT), 6000);
                    attach(s);
                    call.resolve();
                } catch (Exception e) {
                    call.reject("Could not reach the host (" + host + ")");
                }
            }
        }, "runmil-join").start();
    }

    private String gateway() {
        try {
            WifiManager wm = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            DhcpInfo d = wm.getDhcpInfo();
            if (d == null || d.gateway == 0) return "";
            int g = d.gateway;
            return (g & 0xff) + "." + ((g >> 8) & 0xff) + "." + ((g >> 16) & 0xff) + "." + ((g >> 24) & 0xff);
        } catch (Exception e) {
            return "";
        }
    }

    /** A hotspot has no internet: Android may keep sending app traffic over mobile data. Pin this socket to the Wi-Fi network. */
    private void bindToWifi(Socket s) {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities nc = cm.getNetworkCapabilities(n);
                if (nc != null && nc.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) { n.bindSocket(s); return; }
            }
        } catch (Exception ignored) { }
    }

    // ---------------- the connection (one line of JSON per message) ----------------
    private void attach(final Socket s) throws Exception {
        s.setTcpNoDelay(true);
        s.setKeepAlive(true);
        synchronized (this) {
            sock = s;
            out = s.getOutputStream();
            open = true;
        }
        JSObject c = new JSObject();
        c.put("ip", s.getInetAddress() != null ? s.getInetAddress().getHostAddress() : "");
        notifyListeners("connected", c);
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                    String line;
                    while ((line = r.readLine()) != null) {
                        JSObject m = new JSObject();
                        m.put("data", line);
                        notifyListeners("message", m);
                    }
                } catch (Exception ignored) { }
                boolean was;
                synchronized (LanPlugin.this) { was = open && sock == s; if (was) open = false; }
                try { s.close(); } catch (Exception ignored) { }
                if (was) notifyListeners("closed", new JSObject());
            }
        }, "runmil-read").start();
    }

    @PluginMethod
    public void send(final PluginCall call) {
        final String data = call.getString("data");
        if (data != null && open) {
            sender.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        OutputStream o = out;
                        if (o != null && open) { o.write((data + "\n").getBytes(StandardCharsets.UTF_8)); o.flush(); }
                    } catch (Exception e) {
                        try { if (sock != null) sock.close(); } catch (Exception ignored) { }
                    }
                }
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        closeAll();
        call.resolve();
    }

    private synchronized void closeAll() {
        open = false;
        try { if (sock != null) sock.close(); } catch (Exception ignored) { }
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        sock = null;
        out = null;
        server = null;
    }

    @Override
    protected void handleOnDestroy() {
        closeAll();
        sender.shutdownNow();
    }
}
