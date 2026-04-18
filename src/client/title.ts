
import { AnimationSequencer, animationSequencerCreate } from 'glov/client/animation';
import { MODE_DEVELOPMENT } from 'glov/client/client_config';
import { setState } from 'glov/client/engine';
import { ALIGN, fontStyle } from 'glov/client/font';
import { eatAllInput, mouseDownAnywhere } from 'glov/client/input';
import { netSubs } from 'glov/client/net';
import { button, uiButtonWidth, uiGetFont, uiTextHeight } from 'glov/client/ui';
import type { RoomListResponse, RoomRequest, RoomResponse } from '../server/roomlist_worker';
import { createAccountUI } from './account_ui';
import { BUTTON_HEIGHT, game_height, game_width, getLevelDefs, playInit } from './main';
import { PAL_WHITE, palette_font } from './palette';

let account_ui: ReturnType<typeof createAccountUI>;

let net_msg: string | null = null;

let title_anim: AnimationSequencer | null = null;
let title_alpha = {
  title: 0,
  sub: 0,
  button: 0,
};
function stateTitleInitOnce(): void {
  title_anim = animationSequencerCreate();
  let t = 0;

  t = title_anim.add(0, 300, (progress) => {
    title_alpha.title = progress;
  });
  t = title_anim.add(t + 300, 300, (progress) => {
    title_alpha.sub = progress;
  });
  title_anim.add(t + 500, 300, (progress) => {
    title_alpha.button = progress;
  });
}
const style_title = fontStyle(null, {
  color: palette_font[PAL_WHITE],
  outline_color: palette_font[8],
  outline_width: 4,
});

function preLogout(): void {
  // if (test_room) {
  //   assert(test_room.numSubscriptions());
  //   test_room.unsubscribe();
  //   chat_ui.setChannel(null);
  //   test_room = null;
  //   if (!ROOM_REQUIRES_LOGIN) {
  //     setTimeout(getRoom, 1);
  //   }
  // }
}

let roomlist_loaded = false;
function updateRooms(): void {
  netSubs().getChannel('roomlist.the', false).send<RoomListResponse>('list_get', null, function (err, resp) {
    if (err) {
      // ignore for now
      return;
    }
    roomlist_loaded = true;
    console.log(resp);
    // TODO: periodically re-check
  });
}

function onLogin(): void {
  updateRooms();
}

function newGame(idx: number): void {
  net_msg = 'Allocating room...';
  netSubs().getChannel('roomlist.the', false).send<RoomResponse, RoomRequest>('room_alloc', {
    level_idx: idx,
    num_players: getLevelDefs()[idx].players,
  }, function (err, resp) {
    if (err || !resp) {
      // ignore for now
      net_msg = err || 'empty response';
      throw err;
    }
    net_msg = 'Joining...';
    let channel = netSubs().getChannel(`multiplayer.${resp.room_id}`, true);
    channel.onceSubscribe(function () {
      net_msg = null;
      // let game_state = channel.getChannelData('public.gs');
      playInit(idx, channel);
    });
  });
}

let done_once = false;
function stateTitle(dt: number): void {
  if (!done_once) {
    done_once = true;
    stateTitleInitOnce();
  }

  let font = uiGetFont();
  let text_height = uiTextHeight();

  let W = game_width;
  let H = game_height;

  if (title_anim && (mouseDownAnywhere() || MODE_DEVELOPMENT)) {
    title_anim.update(Infinity);
    title_anim = null;
  }
  if (title_anim) {
    if (!title_anim.update(dt)) {
      title_anim = null;
    } else {
      eatAllInput();
    }
  }

  let y = 30;

  font.draw({
    style: style_title,
    alpha: title_alpha.title,
    x: 0, y, w: W, align: ALIGN.HCENTER,
    size: text_height * 3,
    text: 'Drone Supervisor II',
  });
  y += text_height * 3 + 8;

  if (!netSubs().loggedIn()) {

    account_ui.showLogin({
      x: game_width / 2, y,
      text_w: game_width / 2,
      prelogout: preLogout, center: true,
      style: fontStyle(null, {
        outline_width: 2,
        outline_color: 0xFFFFFFff,
        color: 0x000000ff,
      }),
    });


    return;
  }

  let button_width = uiButtonWidth();
  if (button({
    x: game_width - button_width - 4,
    y: 4,
    text: 'Log out',
  })) {
    netSubs().logout();
  }
  font.draw({
    color: palette_font[PAL_WHITE],
    x: game_width - button_width - 8, y: 4, align: ALIGN.VCENTER | ALIGN.HRIGHT,
    h: BUTTON_HEIGHT,
    text: `Welcome, ${netSubs().getDisplayName()}!`
  });

  font.draw({
    color: palette_font[PAL_WHITE],
    alpha: title_alpha.sub,
    x: 0,
    y: H - text_height * 2 - 3,
    w: W, align: ALIGN.HCENTER,
    text: 'Made in 48 hours by Jimb Esser for Ludum Dare 59 and Gamedev.js Jam 2026',
  });

  if (net_msg) {
    y += 20;
    font.draw({
      x: 0, y, w: W,
      align: ALIGN.HCENTER,
      text: net_msg,
    });

    return;
  }

  if (!title_alpha.button) {
    return;
  }
  let color = [1,1,1, title_alpha.button] as const;

  let level_defs = getLevelDefs();

  let button_w = BUTTON_HEIGHT * 3;
  let button_h = BUTTON_HEIGHT;
  let button_param = {
    color,
    w: button_w,
    h: button_h,
  };
  for (let ii = 0; ii < level_defs.length; ++ii) {
    let ld = level_defs[ii];
    if (ld.name === 'debug') {
      continue;
    }

    let x = (game_width - button_param.w * 3 - 4 * 3 - 60) / 2;
    font.draw({
      x, y,
      alpha: title_alpha.button,
      h: BUTTON_HEIGHT,
      align: ALIGN.VCENTER,
      text: ld.name,
    });
    x += 60;
    if (button({
      ...button_param,
      x, y,
      text: 'New Game',
    })) {
      newGame(ii);
    }
    x += button_w + 4;

    if (button({
      ...button_param,
      x, y,
      disabled: true,
      text: 'Resume',
    })) {
      // TODO
    }
    x += button_w + 4;

    if (button({
      ...button_param,
      x, y,
      text: 'Scores',
    })) {
      // TODO
    }
    x += button_w + 4;

    y += BUTTON_HEIGHT + 4;
  }

  if (!roomlist_loaded) {
    font.draw({
      x: 0, y, w: W,
      align: ALIGN.HCENTER,
      text: 'Loading room list...',
    });
  }
}

export function titleInit(): void {
  setState(stateTitle);

  account_ui = createAccountUI();
  netSubs().onLogin(onLogin);
}
