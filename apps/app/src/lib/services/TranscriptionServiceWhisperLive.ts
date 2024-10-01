import { WhisperResponseSchema } from './transcription/WhisperResponseSchema';
import { settings } from '$lib/stores/settings.svelte.js';
import { getExtensionFromAudioBlob } from '$lib/utils';
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import { Schema } from '@effect/schema';
import { TranscriptionService, WhisperingError } from '@repo/shared';
import { Effect, Layer } from 'effect';

const MAX_FILE_SIZE_MB = 25 as const;

export const TranscriptionServiceWhisperLive = Layer.succeed(
	TranscriptionService,
	TranscriptionService.of({
		transcribe: (audioBlob) =>
			Effect.gen(function* () {
				const { openAiApiKey: apiKey, outputLanguage } = settings.value;

				if (!apiKey) {
					return yield* new WhisperingError({
						title: 'OpenAI API Key not provided.',
						description: 'Please enter your OpenAI API key in the settings',
						action: {
							label: 'Go to settings',
							goto: '/settings/transcription',
						},
					});
				}

				if (!apiKey.startsWith('sk-')) {
					return yield* new WhisperingError({
						title: 'Invalid OpenAI API Key',
						description: 'The OpenAI API Key must start with "sk-"',
						action: {
							label: 'Update OpenAI API Key',
							goto: '/settings/transcription',
						},
					});
				}
				const blobSizeInMb = audioBlob.size / (1024 * 1024);
				if (blobSizeInMb > MAX_FILE_SIZE_MB) {
					return yield* new WhisperingError({
						title: `The file size (${blobSizeInMb}MB) is too large`,
						description: `Please upload a file smaller than ${MAX_FILE_SIZE_MB}MB.`,
					});
				}
				const formDataFile = new File(
					[audioBlob],
					`recording.${getExtensionFromAudioBlob(audioBlob)}`,
					{
						type: audioBlob.type,
					},
				);
				const formData = new FormData();
				formData.append('file', formDataFile);
				formData.append('model', 'FunAudioLLM/SenseVoiceSmall');
				if (outputLanguage !== 'auto') formData.append('language', outputLanguage);
				const data = yield* HttpClientRequest.post(
					'https://api.siliconflow.cn/v1/audio/transcriptions',
				).pipe(
					HttpClientRequest.setHeaders({ Authorization: `Bearer ${apiKey}` }),
					HttpClientRequest.formDataBody(formData),
					HttpClient.fetch,
					Effect.andThen(HttpClientResponse.schemaBodyJson(WhisperResponseSchema)),
					Effect.scoped,
					Effect.mapError(
						(error) =>
							new WhisperingError({
								title: 'Error transcribing audio',
								description: error.message,
								error,
							}),
					),
				);
				if ('error' in data) {
					return yield* new WhisperingError({
						title: 'Server error from Whisper API',
						description: data.error.message,
						error: data.error,
					});
				}
				return data.text;
			}),
	}),
);
