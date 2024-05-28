import { RecorderServiceLiveWeb } from '@repo/services/implementations/recorder';
import { Effect } from 'effect';
import { createRecorder } from './create-recorder.svelte';

export const recorder = createRecorder.pipe(Effect.provide(RecorderServiceLiveWeb), Effect.runSync);
