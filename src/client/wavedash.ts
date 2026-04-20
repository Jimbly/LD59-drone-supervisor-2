import assert from 'assert';
import { Score } from './main';

type LeaderboardID = { _opaque: 'LeaderboardID' };

type LeaderboardCreateResponse = {
  data: {
    id: LeaderboardID;
  };
};

let wd = (window as {
  WavedashJS?: {
    updateLoadProgressZeroToOne(v: number): void;
    init(p: { debug: boolean }): void;
    getUserId(): string;
    getUsername(): string;
    getOrCreateLeaderboard(
      leaderboard_id: string,
      descending: 0 | 1,
      time: 0 | 1 | 2,   // 0 = numeric, 1 = time_seconds, 2 = time_milliseconds
    ): Promise<LeaderboardCreateResponse>;
    uploadLeaderboardScore(
      leaderboard_id: LeaderboardID,
      score: number,
      keep_best: boolean,
      ugc_id?: string,
    ): Promise<unknown>;
  };
}).WavedashJS || null;

export function wavedashLoadProgress(value: number): void {
  wd?.updateLoadProgressZeroToOne(value);
}

let ready_called = false;
export function wavedashReady(): void {
  ready_called = true;
  wd?.init({ debug: false });
}

export function wavedashUserName(): string | null {
  assert(ready_called);
  return wd?.getUsername() || null;
}

class Leaderboard {
  leaderboard_id!: LeaderboardID;
  busy: boolean;
  constructor(display_name: string) {
    assert(wd);
    this.busy = true;
    wd.getOrCreateLeaderboard(display_name, 1, 0).then((resp: LeaderboardCreateResponse) => {
      assert(resp);
      assert(resp.data);
      assert(resp.data.id);
      this.leaderboard_id = resp.data.id;
      this.busy = false;
      if (this.dirty) {
        this.tick();
      }
    }, function (err) {
      console.error('Error getting leaderboard', err);
    });
  }
  last_score = 0;
  dirty = false;
  tick(): void {
    this.dirty = false;
    if (!this.last_score) {
      return;
    }
    assert(wd);
    this.busy = true;
    wd.uploadLeaderboardScore(this.leaderboard_id, this.last_score, true).then(() => {
      this.busy = false;
      if (this.dirty) {
        this.tick();
      }
    }, (err) => {
      this.busy = false;
      console.error('Error uploading leaderboard score', err);
    });
  }
  setScore(score: number): void {
    if (score < this.last_score) {
      return;
    }
    this.last_score = score;
    this.dirty = true;
    if (this.busy) {
      return;
    }
    this.tick();
  }
}

let leaderboards: Record<string, Leaderboard> = {};

export function wavedashScoreSubmit(display_name: string, score: Score): void {
  if (display_name === 'Tutorial') {
    return;
  }
  if (!wd) {
    return;
  }
  let lb = leaderboards[display_name];
  if (!lb) {
    lb = leaderboards[display_name] = new Leaderboard(display_name);
  }
  lb.setScore(score.revenue);
}
