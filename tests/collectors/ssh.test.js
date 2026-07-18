const { test } = require('node:test');
const assert = require('node:assert');
const ssh = require('../../src/collectors/ssh');

const SS_ESTABLISHED = `Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
0      0      192.168.0.190:22   192.168.0.201:61160       
0      36     192.168.0.190:22   192.168.0.201:61162       
`;

const SS_LISTENING = `State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess
LISTEN 0      4096         0.0.0.0:22        0.0.0.0:*          
LISTEN 0      4096            [::]:22           [::]:*            
`;

const WHO_FIXTURE = `richard  pts/0        2026-07-17 21:20 (192.168.0.201)
richard  pts/1        2026-07-17 21:21 (192.168.0.201)
`;

test('parseSsEstablished extracts peer addresses and ports', () => {
  const sessions = ssh.parseSsEstablished(SS_ESTABLISHED);
  assert.strictEqual(sessions.length, 2);
  assert.strictEqual(sessions[0].localAddr, '192.168.0.190');
  assert.strictEqual(sessions[0].localPort, 22);
  assert.strictEqual(sessions[0].peerAddr, '192.168.0.201');
  assert.strictEqual(sessions[0].peerPort, 61160);
  assert.strictEqual(sessions[1].peerPort, 61162);
});

test('parseSsEstablished skips header and empty lines', () => {
  assert.deepStrictEqual(ssh.parseSsEstablished(''), []);
  assert.deepStrictEqual(ssh.parseSsEstablished('Recv-Q Send-Q Local Address:Port\n'), []);
});

test('parseSsListening detects port 22', () => {
  const result = ssh.parseSsListening(SS_LISTENING);
  assert.strictEqual(result.listening, true);
  assert.strictEqual(result.addr, '0.0.0.0');
});

test('parseSsListening returns false when no :22', () => {
  const result = ssh.parseSsListening('LISTEN 0 4096 0.0.0.0:80 0.0.0.0:*\n');
  assert.strictEqual(result.listening, false);
});

test('parseWho extracts user, tty, time, and source', () => {
  const users = ssh.parseWho(WHO_FIXTURE);
  assert.strictEqual(users.length, 2);
  assert.strictEqual(users[0].user, 'richard');
  assert.strictEqual(users[0].tty, 'pts/0');
  assert.strictEqual(users[0].time, '2026-07-17 21:20');
  assert.strictEqual(users[0].from, '192.168.0.201');
});

test('table shows sessions and users with FROM/TO columns', () => {
  const data = {
    sessions: ssh.parseSsEstablished(SS_ESTABLISHED),
    listening: ssh.parseSsListening(SS_LISTENING),
    users: ssh.parseWho(WHO_FIXTURE),
  };
  const lean = ssh.table(data, { verbose: false });
  // 1 listening + 2 sessions + 2 users = 5 rows
  assert.strictEqual(lean.rows.length, 5);
  assert.deepStrictEqual(lean.head, ['TYPE', 'FROM', 'TO', 'DETAILS']);
  assert.strictEqual(lean.rows[0][0], 'Listening');
  // Session: from peerAddr, to localAddr:port
  assert.strictEqual(lean.rows[1][0], 'Session');
  assert.strictEqual(lean.rows[1][1], '192.168.0.201');
  assert.strictEqual(lean.rows[1][2], '192.168.0.190:22');
  // User: from remote IP, to tty
  assert.strictEqual(lean.rows[3][0], 'User');
  assert.strictEqual(lean.rows[3][1], '192.168.0.201');
  assert.strictEqual(lean.rows[3][2], 'pts/0');
});