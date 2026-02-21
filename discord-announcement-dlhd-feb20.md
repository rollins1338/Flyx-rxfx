# 📡 Live TV (DLHD) is Back Online

DLHD decided to play musical chairs with their infrastructure and forgot to invite us. Rude. But we figured out where they moved the chairs, so we're back in the game.

## What happened?

DLHD rotated a bunch of their upstream endpoints and auth domains — basically the equivalent of changing all the locks on the building overnight. Our backend was still knocking on doors that no longer existed (some returned SSL failures, others just straight up vanished from DNS). Streams were dead across the board.

## What we did

- Ran a full recon sweep across their entire infrastructure to map out what changed
- Identified the new endpoints and updated our auth pipeline accordingly
- Rebuilt and redeployed our extraction worker with the corrected routing
- Verified the full HLS pipeline end-to-end: M3U8 playlist fetch → segment delivery → AES-128 key negotiation → decryption chain. All green across multiple test channels.

Segments are proxied through our edge workers and keys are fetched through our residential proxy bridge, so playback should be smooth and reliable.

## Do I need to do anything?

Nope. Everything is server-side. Just hit play and vibe.

If a channel is acting up, give it a moment — live streams can be temperamental. If it's still broken after a minute or two, ping us in support with the channel name and we'll take a look.

Cheers 🍻
