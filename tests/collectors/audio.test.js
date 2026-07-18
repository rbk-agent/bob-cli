const { test } = require('node:test');
const assert = require('node:assert');
const audio = require('../../src/collectors/audio');

const WPCTL_FIXTURE = `PipeWire 'pipewire-0' [1.0.5, richard@richard-lenovo, cookie:4146752268]
 └─ Clients:
        34. pipewire                            [1.0.5, richard@richard-lenovo, pid:400934]

Audio
 ├─ Devices:
 │      39. Built-in Audio                      [alsa]
 ├─ Sinks:
 │      38. Built-in Audio Analog Stereo        [vol: 0.40]
 │  *   54. UMC404HD 192k Analog Surround 4.0   [vol: 1.00]
 ├─ Sources:
 │  *   37. Built-in Audio Analog Stereo        [vol: 1.00]
 │      56. UMC404HD 192k Analog Surround 4.0   [vol: 1.00]
 └─ Streams:

Settings
 └─ Default Configured Node Names:
         0. Audio/Sink    alsa_output.usb-BEHRINGER_UMC404HD_192k-00
`;

const AMIXER_FIXTURE = `Simple mixer control 'Master',0
  Capabilities: pvolume pvolume-joined pswitch pswitch-joined
  Playback channels: Mono
  Limits: Playback 0 - 87
  Mono: Playback 56 [64%] [-23.25dB] [on]
`;

const APLAY_FIXTURE = `**** List of PLAYBACK Hardware Devices ****
card 0: PCH [HDA Intel PCH], device 0: ALC3232 Analog [ALC3232 Analog]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 1: U192k [UMC404HD 192k], device 0: USB Audio [USB Audio]
`;

test('parseWpctl extracts server name, sinks, and sources with default flags', () => {
  const data = audio.parseWpctl(WPCTL_FIXTURE);
  assert.strictEqual(data.serverName, 'pipewire-0');
  assert.strictEqual(data.sinks.length, 2);
  assert.strictEqual(data.sources.length, 2);

  // Default sink = the one with *
  assert.strictEqual(data.defaultSink.name, 'UMC404HD 192k Analog Surround 4.0');
  assert.strictEqual(data.defaultSink.volume, 1);
  assert.strictEqual(data.defaultSink.default, true);

  // Non-default sink
  assert.strictEqual(data.sinks[0].name, 'Built-in Audio Analog Stereo');
  assert.strictEqual(data.sinks[0].volume, 0.4);
  assert.strictEqual(data.sinks[0].default, false);

  // Default source
  assert.strictEqual(data.defaultSource.name, 'Built-in Audio Analog Stereo');
  assert.strictEqual(data.defaultSource.default, true);
});

test('parseAmixer extracts volume, percent, and mute state', () => {
  const data = audio.parseAmixer(AMIXER_FIXTURE);
  assert.strictEqual(data.control, 'Master');
  assert.strictEqual(data.volume, 56);
  assert.strictEqual(data.percent, 64);
  assert.strictEqual(data.muted, false);
});

test('parseCards extracts sound cards from aplay -l', () => {
  const cards = audio.parseCards(APLAY_FIXTURE);
  assert.strictEqual(cards.length, 2);
  assert.strictEqual(cards[0].card, 0);
  assert.strictEqual(cards[0].cardId, 'PCH');
  assert.strictEqual(cards[0].cardName, 'HDA Intel PCH');
  assert.strictEqual(cards[1].card, 1);
  assert.strictEqual(cards[1].cardName, 'UMC404HD 192k');
});

test('table shows sinks and sources with volume', () => {
  const data = audio.parseWpctl(WPCTL_FIXTURE);
  const lean = audio.table(data, { verbose: false });
  assert.strictEqual(lean.rows.length, 4); // 2 sinks + 2 sources
  assert.deepStrictEqual(lean.head, ['TYPE', 'NAME', 'VOLUME']);

  const verbose = audio.table(data, { verbose: true });
  assert.deepStrictEqual(verbose.head, ['TYPE', 'NAME', 'VOLUME', 'ID', 'DEFAULT']);
});