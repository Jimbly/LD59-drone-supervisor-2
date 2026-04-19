import { UISoundID } from 'glov/client/ui';

export const SOUND_DATA = {
  // online multiplayer sounds, ignore these
  // user_join: 'rollover',
  // user_leave: 'rollover',
  // msg_in: 'internal/msg_in',
  // msg_err: 'internal/msg_err',
  // msg_out_err: 'internal/msg_out_err',
  // msg_out: 'internal/msg_out',

  button_click: ['button_click1', 'button_click2'],
  rollover: { file: 'rollover', volume: 0.25 },
  place_error: ['err'],
  place_rotate: ['synth1up1', 'synth1up2', 'synth1up3'],
  place_good: ['synth1up4','synth1up5','synth1up6'],
  sell: ['synth1down1', 'synth1down2', 'synth1down3'],

  // low
  trash: ['err'],
  pickup: ['1up1', '1up2'],
  dropoff: ['1down1', '1down2', '1down3'],
  // med
  craft: ['1up1', '1up2'],
  craft_pickup: ['1up4', '1up5', '1up6'],
  zoom: ['5up1'],
  go: ['2chordup'],
  // high
  base_sale: ['3up1'],

} satisfies Partial<Record<string, UISoundID | string | string[] | UISoundID[]>>;
