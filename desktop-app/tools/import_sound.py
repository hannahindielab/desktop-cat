"""Turns a sound file into one the cat can play.

Run: python tools/import_sound.py <file> <name> [--loop] [--speed 1.2]

Trims silence off the ends and evens out the level. With --loop, blends the end
into the start so the sound goes round without a seam. With --speed, plays it
faster, which also raises its pitch.
"""
import os
import subprocess
import sys
import wave

import numpy as np

RATE = 44100
PEAK = 0.89
SILENCE = 0.01
BLEND_SECONDS = 0.25
OUT_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'src', 'sounds')


def source_rate(path):
    return int(subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', path],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip())


def decode(path, speed):
    # Played faster the way tape is: shorter and higher, as a smaller voice.
    # The speed applies to the file's own rate, which need not be ours.
    shift = f'asetrate={source_rate(path) * speed:.0f},aresample={RATE}'
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-af', shift, '-f', 'f32le', '-'],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype='<f4').astype(float)


def trim(samples):
    loud = np.nonzero(np.abs(samples) > SILENCE)[0]
    return samples[loud[0]:loud[-1] + 1]


def blend_ends(samples):
    size = int(RATE * BLEND_SECONDS)
    if len(samples) < size * 4:
        raise SystemExit('too short to loop smoothly')
    # Equal power, so the level does not dip at the join.
    fade = np.linspace(0, np.pi / 2, size)
    start = samples[:size] * np.sin(fade) + samples[-size:] * np.cos(fade)
    return np.concatenate([start, samples[size:-size]])


def main():
    path, name = sys.argv[1:3]
    options = sys.argv[3:]
    is_loop = '--loop' in options
    speed = float(options[options.index('--speed') + 1]) if '--speed' in options else 1.0

    samples = trim(decode(path, speed))
    if is_loop:
        samples = blend_ends(samples)
    samples = samples / np.abs(samples).max() * PEAK

    with wave.open(os.path.join(OUT_FOLDER, f'{name}.wav'), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes((samples * 32767).astype('<i2').tobytes())

    print(f'{name}: {len(samples) / RATE:.2f}s, loudness {20 * np.log10(np.sqrt(np.mean(samples ** 2))):.1f} dB')


main()
