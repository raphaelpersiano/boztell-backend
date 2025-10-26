# WhatsApp Audio Format Requirements & Handling

## WhatsApp Supported Audio Formats

According to [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media):

### ✅ Natively Supported Audio Formats (NO conversion needed)

| Format | MIME Type | Notes |
|--------|-----------|-------|
| **AAC** | `audio/aac` | Advanced Audio Coding - Good quality, widely supported |
| **AMR** | `audio/amr` | Adaptive Multi-Rate - Voice optimized |
| **MP3** | `audio/mpeg` | MPEG Audio Layer 3 - Universal support |
| **MP4 Audio** | `audio/mp4` | MP4 container with audio |
| **OGG** | `audio/ogg` | **⚠️ OPUS codec ONLY** - Base `audio/ogg` without OPUS is NOT supported |

### ⚠️ OGG Format Critical Requirements

```
WhatsApp Requirement: audio/ogg (OPUS codecs only; base audio/ogg not supported; mono input only)
```

**What this means:**
- ✅ OGG container with **OPUS codec** = SUPPORTED
- ❌ OGG container with **Vorbis codec** = NOT SUPPORTED
- ❌ OGG container with **other codecs** = NOT SUPPORTED
- ✅ **Mono (1 channel)** = REQUIRED
- ❌ Stereo (2 channels) = May not work

## Our Implementation Strategy

### Priority 1: Use Native Formats (No Conversion)

If the uploaded audio is already in a supported format, we send it **directly** to WhatsApp without any conversion:

```javascript
// These formats are sent AS-IS (no conversion):
- audio/aac      ✅ Direct upload
- audio/mp4      ✅ Direct upload
- audio/mpeg     ✅ Direct upload (MP3)
- audio/amr      ✅ Direct upload
- audio/ogg      ✅ Direct upload (assuming OPUS codec)
```

### Priority 2: Convert Unsupported Formats

If the uploaded audio is NOT in a supported format (e.g., `audio/webm`, `audio/wav`), we automatically convert it to **OGG with OPUS codec**:

```javascript
// These formats are AUTO-CONVERTED to OGG (OPUS):
- audio/webm     🔄 Convert to OGG (OPUS)
- audio/wav      🔄 Convert to OGG (OPUS)
- audio/flac     🔄 Convert to OGG (OPUS)
- audio/m4a      🔄 Convert to OGG (OPUS)
```

## Conversion Details (FFmpeg)

When conversion is needed, we use FFmpeg with these settings:

```javascript
ffmpeg(inputStream)
  .inputFormat(inputFormat)           // Input: webm, wav, etc.
  .audioCodec('libopus')               // ✅ OPUS codec (WhatsApp requirement)
  .audioBitrate('128k')                // 128kbps (good quality for voice)
  .audioChannels(1)                    // Mono (WhatsApp requirement)
  .audioFrequency(48000)               // 48kHz (OPUS standard)
  .format('ogg')                       // OGG container
```

### Why These Settings?

1. **`libopus` codec**: WhatsApp explicitly requires OPUS codec for OGG
2. **128kbps bitrate**: Balance between quality and file size for voice
3. **Mono (1 channel)**: WhatsApp requirement for OGG audio
4. **48kHz sample rate**: Standard for OPUS codec

## Code Implementation

### 1. Check if Conversion Needed

```javascript
// src/utils/audioConverter.js
export function needsAudioConversion(mimeType) {
  const whatsappSupportedAudio = [
    'audio/aac',      // Supported ✅
    'audio/mp4',      // Supported ✅
    'audio/mpeg',     // Supported ✅
    'audio/amr',      // Supported ✅
    'audio/ogg'       // Supported ✅ (OPUS codec)
  ];
  
  // Only convert if format is NOT natively supported
  return !whatsappSupportedAudio.includes(mimeType);
}
```

### 2. Convert to OGG (OPUS)

```javascript
// src/utils/audioConverter.js
export async function convertAudioToOgg(inputBuffer, inputFormat) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputStream)
      .inputFormat(inputFormat)
      .audioCodec('libopus')         // ✅ OPUS codec
      .audioBitrate('128k')
      .audioChannels(1)              // Mono
      .audioFrequency(48000)         // 48kHz
      .format('ogg')
      .on('end', () => resolve(outputBuffer))
      .on('error', (err) => reject(err))
      .pipe();
  });
}
```

### 3. Use in Upload Flow

```javascript
// src/routes/messages.js
if (mediaType === 'audio' && needsAudioConversion(mimetype)) {
  // Convert to OGG (OPUS)
  processedBuffer = await convertAudioToOgg(buffer, ffmpegFormat);
  processedMimetype = 'audio/ogg';
  processedFilename = originalname.replace(/\.[^.]+$/, '.ogg');
}
```

## Testing

### Test Native Formats (No Conversion)

```bash
# Test AAC (should send directly)
curl -X POST http://localhost:3000/messages/send-media-combined \
  -F "to=6287879565390" \
  -F "media=@voice.aac" \
  -F "user_id=agent-001"

# Test MP3 (should send directly)
curl -X POST http://localhost:3000/messages/send-media-combined \
  -F "to=6287879565390" \
  -F "media=@voice.mp3" \
  -F "user_id=agent-001"
```

### Test Conversion

```bash
# Test WebM (should convert to OGG with OPUS)
curl -X POST http://localhost:3000/messages/send-media-combined \
  -F "to=6287879565390" \
  -F "media=@voice.webm" \
  -F "user_id=agent-001"

# Check logs for: "Audio conversion to OGG (OPUS codec) successful"
```

## Log Messages

### No Conversion Needed

```
No conversion needed - audio format already supported by WhatsApp
Format: audio/aac | audio/mp3 | audio/amr | audio/mp4 | audio/ogg
```

### Conversion Performed

```
🔄 Audio format not supported by WhatsApp - converting to OGG with OPUS codec
Original: audio/webm (150 KB)
✅ Audio conversion to OGG (OPUS codec) successful
Converted: audio/ogg (120 KB) | Compression: 20%
```

## Benefits of This Approach

1. **No Unnecessary Conversion**: Supported formats (AAC, MP3, AMR, MP4) are sent directly
2. **Automatic Fallback**: Unsupported formats (WebM, WAV) are auto-converted
3. **OPUS Compliance**: All OGG conversions use OPUS codec as required by WhatsApp
4. **Quality Optimized**: 128kbps mono @ 48kHz is perfect for voice messages
5. **File Size Optimized**: OPUS codec provides excellent compression for voice

## Troubleshooting

### Issue: "OGG format not working"

**Solution**: Make sure you're using **OPUS codec**, not Vorbis or other codecs.

```bash
# Check audio codec in OGG file
ffprobe voice.ogg

# Should show: Audio: opus
# NOT: Audio: vorbis
```

### Issue: "Audio plays in stereo instead of mono"

**Solution**: Our converter forces mono with `.audioChannels(1)`

### Issue: "Large file size"

**Solution**: 
- 128kbps is good for voice quality
- OPUS provides excellent compression
- Consider reducing bitrate to 64kbps for even smaller files:

```javascript
.audioBitrate('64k')  // Lower bitrate = smaller file
```

## References

- [WhatsApp Cloud API - Media](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
- [OPUS Audio Codec](https://opus-codec.org/)
- [FFmpeg OPUS Encoding](https://trac.ffmpeg.org/wiki/Encode/HighQualityAudio)

---

**Summary**: We prioritize native formats (no conversion) and only convert to OGG (OPUS codec) when needed. All conversions are OPUS-compliant with WhatsApp requirements. 🎵✅
