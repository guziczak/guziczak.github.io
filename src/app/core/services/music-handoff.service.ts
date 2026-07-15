import { Injectable } from '@angular/core';

export interface MusicHandoffState {
  time: number;
  playing: boolean;
}

type MusicStateProvider = () => MusicHandoffState;

const EMPTY_STATE: MusicHandoffState = { time: 0, playing: false };
const MUSIC_TIME_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/;

function normalizeState(
  state: MusicHandoffState | null | undefined,
): MusicHandoffState {
  const time = Number(state?.time);
  return {
    time: Number.isFinite(time) && time > 0 ? time : 0,
    playing: !!state?.playing,
  };
}

/**
 * A small bridge between the hero's WebAudio player and links rendered by other sections.
 * The player remains owned by the hero; consumers can only take an atomic snapshot and ask it
 * to pause before an external navigation.
 */
@Injectable({ providedIn: 'root' })
export class MusicHandoffService {
  private provider: MusicStateProvider | null = null;

  registerProvider(provider: MusicStateProvider): () => void {
    this.provider = provider;
    return () => {
      if (this.provider === provider) this.provider = null;
    };
  }

  captureAndPause(): MusicHandoffState {
    try {
      return normalizeState(this.provider?.() ?? EMPTY_STATE);
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  read(search: string): MusicHandoffState | null {
    const params = new URLSearchParams(search);
    const rawTime = params.get('musicTime');
    const rawPlaying = params.get('musicPlaying');
    if (
      rawTime === null ||
      rawPlaying === null ||
      !MUSIC_TIME_PATTERN.test(rawTime) ||
      !/^[01]$/.test(rawPlaying)
    ) {
      return null;
    }

    return normalizeState({
      time: Number(rawTime),
      playing: rawPlaying === '1',
    });
  }

  withState(url: string, state: MusicHandoffState): string {
    const normalized = normalizeState(state);
    const target = new URL(url);
    const rounded = Math.round(normalized.time * 1000) / 1000;

    target.searchParams.set(
      'musicTime',
      rounded.toFixed(3).replace(/\.?0+$/, ''),
    );
    target.searchParams.set('musicPlaying', normalized.playing ? '1' : '0');
    return target.toString();
  }
}
