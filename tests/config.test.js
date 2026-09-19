import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG_URL,
  buildBindMap,
  buildSettings,
  getActionName,
  getBindCategory,
  getTooltipContent,
  mapConfigKeyToVisualId,
  parseConfigVars,
  resolveAliasAction,
  stripInlineComment,
} from '../js/config.js';

const FIXTURE = `
// comment
sensitivity "1.1"
zoom_sensitivity_ratio "0.818933"
fps_max "300"
bind "w" "+forward"
bind "y" "radio2"
bind "z" "say GL & HF"
bind "CTRL" "+sprint"
bind "ctrl" "+n_ctrl_donate"
bind "kp_2" "n_buy_m4a1s_ak"
bind "kp_plus" "n_refund_all"
alias n_buy_m4a1s_ak "buy m4a1_silencer; buy ak47"
alias n_refund_all "sellbackall; sellbackall"
alias +n_ctrl_donate "+sprint; bind kp_divide d_buy_startpistol"
alias d_buy_zeus "buy x 34 x"   // trailing comment
alias loop_a "loop_b"
alias loop_b "loop_a"
`;

describe('stripInlineComment', () => {
  it('keeps // inside quoted binds', () => {
    assert.equal(
      stripInlineComment('bind "z" "say http://example.com"'),
      'bind "z" "say http://example.com"'
    );
  });

  it('strips trailing comments outside quotes', () => {
    assert.equal(
      stripInlineComment('alias d_buy_zeus "buy x 34 x"   // EQUIPMENT2'),
      'alias d_buy_zeus "buy x 34 x"'
    );
  });
});

describe('parseConfigVars', () => {
  it('parses cvars, binds, aliases and ignores comments', () => {
    const parsed = parseConfigVars(FIXTURE);
    assert.equal(parsed.sensitivity, '1.1');
    assert.equal(parsed.fps_max, '300');
    assert.equal(parsed.__aliases.n_buy_m4a1s_ak, 'buy m4a1_silencer; buy ak47');
    assert.equal(parsed.__aliases.d_buy_zeus, 'buy x 34 x');
    assert.ok(parsed.__binds.some((bind) => bind.key === 'w' && bind.action === '+forward'));
  });

  it('keeps later duplicate binds so last write wins', () => {
    const parsed = parseConfigVars(FIXTURE);
    const ctrlBinds = parsed.__binds.filter((bind) => bind.key.toLowerCase() === 'ctrl');
    assert.equal(ctrlBinds.at(-1).action, '+n_ctrl_donate');
  });
});

describe('German keyboard mapping', () => {
  it('swaps US config Y/Z onto a DE layout', () => {
    assert.equal(mapConfigKeyToVisualId('y'), 'z');
    assert.equal(mapConfigKeyToVisualId('z'), 'y');
    assert.equal(mapConfigKeyToVisualId('Y'), 'z');
    assert.equal(mapConfigKeyToVisualId('w'), 'w');
  });

  it('maps the last bind for a visual key', () => {
    const parsed = parseConfigVars(FIXTURE);
    const bindMap = buildBindMap(parsed.__binds);
    assert.equal(bindMap.z, 'radio2');
    assert.equal(bindMap.y, 'say GL & HF');
    assert.equal(bindMap.ctrl, '+n_ctrl_donate');
    assert.equal(bindMap.w, '+forward');
  });
});

describe('alias resolution', () => {
  it('resolves buy aliases to weapon names', () => {
    const parsed = parseConfigVars(FIXTURE);
    const resolved = resolveAliasAction('n_buy_m4a1s_ak', parsed.__aliases);
    assert.equal(getActionName(resolved, parsed.__aliases), 'Buy: M4A1-S / AK-47');
    assert.equal(getActionName('n_buy_m4a1s_ak', parsed.__aliases), 'Buy: M4A1-S / AK-47');
    assert.equal(getBindCategory(getActionName('n_buy_m4a1s_ak', parsed.__aliases)), 'buy');
  });

  it('labels refund aliases as sell all', () => {
    const parsed = parseConfigVars(FIXTURE);
    assert.equal(getActionName('n_refund_all', parsed.__aliases), 'Sell All');
  });

  it('does not recurse forever on cyclic aliases', () => {
    const parsed = parseConfigVars(FIXTURE);
    assert.equal(resolveAliasAction('loop_a', parsed.__aliases), 'loop_a');
  });

  it('keeps walk as the ctrl tooltip title', () => {
    const parsed = parseConfigVars(FIXTURE);
    const tooltip = getTooltipContent('ctrl', 'Walk', '+n_ctrl_donate', parsed.__aliases);
    assert.deepEqual(tooltip, {
      title: 'Walk',
      detail: 'In buyzone: buy/drop modifier',
    });
  });
});

describe('buildSettings', () => {
  it('computes eDPI from DPI and sensitivity', () => {
    const settings = buildSettings({ sensitivity: '1.1', zoom_sensitivity_ratio: '0.818933' });
    assert.equal(settings['Mouse & Sensitivity'].eDPI, '1320');
    assert.equal(settings['Mouse & Sensitivity']['Zoom Sensitivity'], '0.8189');
  });
});

describe('config fetch URL', () => {
  it('loads the config from a root-absolute path', () => {
    assert.equal(CONFIG_URL, '/config.cfg');
  });
});

describe('real config.cfg', () => {
  it('parses live binds including DE mapping and donate ctrl layer', () => {
    const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'config.cfg');
    const parsed = parseConfigVars(readFileSync(configPath, 'utf8'));
    const bindMap = buildBindMap(parsed.__binds);

    assert.ok(parsed.__binds.length > 20);
    assert.equal(bindMap.z, 'radio2');
    assert.equal(bindMap.y, 'say GL & HF');
    assert.equal(getActionName(bindMap.kp_2, parsed.__aliases), 'Buy: M4A1-S / AK-47');
    assert.equal(getActionName(bindMap.ctrl, parsed.__aliases), 'Walk');
    assert.equal(
      getTooltipContent('ctrl', 'Walk', bindMap.ctrl, parsed.__aliases).detail,
      'In buyzone: buy/drop modifier'
    );
  });
});
