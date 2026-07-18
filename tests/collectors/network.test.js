const { test } = require('node:test');
const assert = require('node:assert');
const network = require('../../src/collectors/network');

const IP_FIXTURE = JSON.stringify([
  {
    ifindex: 1, ifname: 'lo', flags: ['LOOPBACK', 'UP'], operstate: 'UNKNOWN',
    address: '00:00:00:00:00:00', mtu: 65536, link_type: 'loopback',
    addr_info: [{ family: 'inet', local: '127.0.0.1', prefixlen: 8, scope: 'host' }],
  },
  {
    ifindex: 2, ifname: 'enp0s25', flags: ['BROADCAST', 'MULTICAST', 'UP', 'LOWER_UP'], operstate: 'UP',
    address: '68:f7:28:c2:dd:1f', mtu: 1500, link_type: 'ether',
    addr_info: [{ family: 'inet', local: '192.168.0.202', prefixlen: 24, scope: 'global' }],
  },
  {
    ifindex: 3, ifname: 'wlp3s0', flags: ['BROADCAST', 'MULTICAST', 'UP', 'LOWER_UP'], operstate: 'UP',
    address: '34:02:86:b1:2f:51', mtu: 1500, link_type: 'ether',
    addr_info: [{ family: 'inet', local: '192.168.0.190', prefixlen: 24, scope: 'global' }],
  },
  {
    ifindex: 4, ifname: 'tailscale0', flags: ['POINTOPOINT', 'UP'], operstate: 'UNKNOWN',
    address: null, mtu: 1280, link_type: 'none',
    addr_info: [{ family: 'inet', local: '100.96.200.86', prefixlen: 32, scope: 'global' }],
  },
  {
    ifindex: 5, ifname: 'docker0', flags: ['NO-CARRIER', 'BROADCAST'], operstate: 'DOWN',
    address: 'ba:9a:12:5b:91:aa', mtu: 1500, link_type: 'ether',
    addr_info: [],
  },
]);

const WIFI_FIXTURE = `no:richard-iot:75:2452 MHz
yes:richards-network-2-4-ghz:70:2452 MHz
no:SETUP-85EC:45:2462 MHz
`;

const TAILSCALE_FIXTURE = JSON.stringify({
  Version: '1.98.4',
  BackendState: 'Running',
  TailscaleIPs: ['100.96.200.86', 'fd7a:115c:a1e0::4b01:c89f'],
  Self: {
    HostName: 'richard-lenovo',
    TailscaleIPs: ['100.96.200.86', 'fd7a:115c:a1e0::4b01:c89f'],
  },
  Peer: {
    node1: {
      HostName: 'Pixel 8a',
      TailscaleIPs: ['100.75.66.52'],
      Online: true,
      Active: true,
      Relay: 'ord',
      LastSeen: '2026-07-17T10:00:00Z',
    },
    node2: {
      HostName: "MacBook Pro",
      TailscaleIPs: ['100.96.54.79'],
      Online: false,
      Active: false,
      Relay: '',
      LastSeen: '2026-07-15T10:00:00Z',
    },
  },
});

test('isVirtual filters lo, docker, bridges, veth, tailscale0', () => {
  assert.strictEqual(network.isVirtual('lo'), true);
  assert.strictEqual(network.isVirtual('docker0'), true);
  assert.strictEqual(network.isVirtual('br-abc123'), true);
  assert.strictEqual(network.isVirtual('veth1234'), true);
  assert.strictEqual(network.isVirtual('tailscale0'), true);
  assert.strictEqual(network.isVirtual('enp0s25'), false);
  assert.strictEqual(network.isVirtual('wlp3s0'), false);
});

test('parseInterfaces filters virtual ifaces and classifies type', () => {
  const ifaces = network.parseInterfaces(JSON.parse(IP_FIXTURE));
  assert.strictEqual(ifaces.length, 2); // enp0s25 + wlp3s0 only
  assert.strictEqual(ifaces[0].name, 'enp0s25');
  assert.strictEqual(ifaces[0].type, 'ethernet');
  assert.strictEqual(ifaces[0].ip, '192.168.0.202');
  assert.strictEqual(ifaces[0].cidr, '192.168.0.202/24');
  assert.strictEqual(ifaces[1].name, 'wlp3s0');
  assert.strictEqual(ifaces[1].type, 'wifi');
  assert.strictEqual(ifaces[1].ip, '192.168.0.190');
});

test('parseWifi extracts the connected SSID', () => {
  const wifi = network.parseWifi(WIFI_FIXTURE);
  assert.strictEqual(wifi.ssid, 'richards-network-2-4-ghz');
  assert.strictEqual(wifi.signal, 70);
  assert.strictEqual(wifi.freq, '2452 MHz');
});

test('parseWifi returns null when no active connection', () => {
  const wifi = network.parseWifi('no:foo:50:2412 MHz\nno:bar:40:2437 MHz\n');
  assert.strictEqual(wifi, null);
});

test('parseTailscale extracts self IPs, state, and peers', () => {
  const ts = network.parseTailscale(TAILSCALE_FIXTURE);
  assert.strictEqual(ts.running, true);
  assert.strictEqual(ts.self.hostname, 'richard-lenovo');
  assert.deepStrictEqual(ts.self.ips, ['100.96.200.86', 'fd7a:115c:a1e0::4b01:c89f']);
  assert.strictEqual(ts.peers.length, 2);
  assert.strictEqual(ts.peers[0].hostname, 'Pixel 8a');
  assert.strictEqual(ts.peers[0].online, true);
  assert.strictEqual(ts.peers[1].hostname, 'MacBook Pro');
  assert.strictEqual(ts.peers[1].online, false);
});

test('table shows interface, type, state, ip', () => {
  const ifaces = network.parseInterfaces(JSON.parse(IP_FIXTURE));
  const lean = network.table({ interfaces: ifaces }, { verbose: false });
  assert.deepStrictEqual(lean.head, ['INTERFACE', 'TYPE', 'STATE', 'IP']);
  assert.strictEqual(lean.rows.length, 2);

  const verbose = network.table({ interfaces: ifaces }, { verbose: true });
  assert.deepStrictEqual(verbose.head, ['INTERFACE', 'TYPE', 'STATE', 'IP', 'MAC', 'MTU']);
});