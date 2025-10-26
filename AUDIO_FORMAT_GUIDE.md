# Audio Format Guide for WhatsApp Integration

## 🎉 Auto-Conversion Feature (Updated)

**Good news!** Backend now **automatically converts** unsupported audio formats to OGG (Opus codec).

### Supported Audio Formats

WhatsApp Cloud API natively supports:
- ✅ **audio/ogg** (with Opus codec) - Native support
- ✅ **audio/aac** - Native support
- ✅ **audio/mp4** - Native support (M4A)
- ✅ **audio/mpeg** - Native support (MP3)
- ✅ **audio/amr** - Native support

**Auto-converted by backend:**
- 🔄 **audio/webm** → Automatically converted to audio/ogg (Opus codec)
- 🔄 **audio/wav** → Automatically converted to audio/ogg (Opus codec)
- 🔄 Any unsupported audio format → Converted to audio/ogg

## How It Works

1. Frontend sends audio file (any format including WebM)
2. Backend detects if format is not supported by WhatsApp
3. Backend automatically converts to audio/ogg with Opus codec
4. Backend uploads converted file to WhatsApp
5. Frontend receives success response with conversion details

## Frontend Implementation

You can now send **any audio format**, including audio/webm:

### ✅ Simple - Just send audio/webm (backend handles conversion):
```javascript
const mediaRecorder = new MediaRecorder(stream);
// Use default format - backend will convert if needed

const audioChunks = [];

mediaRecorder.addEventListener('dataavailable', (event) => {
  audioChunks.push(event.data);
});

mediaRecorder.addEventListener('stop', async () => {
  const audioBlob = new Blob(audioChunks, { 
    type: mediaRecorder.mimeType // Can be audio/webm
  });
  
  const audioFile = new File([audioBlob], 'voice-note.webm', { 
    type: audioBlob.type 
  });
  
  // Send to backend - conversion happens automatically
  const formData = new FormData();
  formData.append('media', audioFile);
  formData.append('to', phoneNumber);
  formData.append('user_id', userId);
  
  const response = await fetch('/api/messages/send-media-combined', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  // Check if conversion was performed
  if (result.audio_conversion) {
    console.log('Audio was converted:', result.audio_conversion);
    // {
    //   performed: true,
    //   original_format: 'audio/webm',
    //   converted_format: 'audio/ogg',
    //   original_size: 245678,
    //   converted_size: 189234,
    //   compression_ratio: '22.97%'
    // }
  }
});
```

### ✅ Optimal - Use audio/ogg natively (no conversion needed):
```javascript
// Check if browser supports audio/ogg with opus codec
const mimeType = 'audio/ogg;codecs=opus';

if (MediaRecorder.isTypeSupported(mimeType)) {
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    audioBitsPerSecond: 128000 // 128kbps
  });
  
  // ... rest of the code
  // Backend will NOT convert - already in correct format
}
```

## Browser Compatibility

All modern browsers are now supported since backend handles conversion:

| Browser | Native audio/ogg | audio/webm | Backend Handles |
|---------|------------------|------------|-----------------|
| Chrome 49+ | ✅ Yes (opus codec) | ✅ Yes | ✅ Auto-converts webm |
| Firefox 25+ | ✅ Yes (opus codec) | ✅ Yes | ✅ Auto-converts webm |
| Safari 14.1+ | ✅ Yes (opus codec) | ❌ Limited | ✅ Converts if needed |
| Edge 79+ | ✅ Yes (opus codec) | ✅ Yes | ✅ Auto-converts webm |

**Recommendation:** Let browser use its default format - backend will handle conversion automatically.

## Performance Considerations

### Conversion Process:
- **Time:** ~100-500ms for typical voice note (10-60 seconds)
- **Quality:** Opus codec at 128kbps - excellent for voice
- **Size:** Usually 20-30% smaller after conversion (WebM → OGG)
- **Server load:** Minimal - ffmpeg is highly optimized

### When to Use Native OGG:
- ✅ If browser supports audio/ogg natively (saves server resources)
- ✅ For very long recordings (>5 minutes) to reduce conversion time
- ✅ When you want to avoid any server-side processing

### When Auto-Conversion is Fine:
- ✅ For typical voice notes (<60 seconds)
- ✅ When you want simpler frontend code
- ✅ When you need to support all browsers without checking capabilities

## API Response

When audio conversion is performed, the response includes conversion details:

```json
{
  "success": true,
  "to": "6287879565390",
  "mediaType": "audio",
  "filename": "voice-note.ogg",
  "size": 189234,
  "message_id": "abc-123",
  "whatsapp_media_id": "wa-456",
  "whatsapp_message_id": "wamid.789",
  "storage_url": "https://storage.example.com/...",
  "audio_conversion": {
    "performed": true,
    "original_format": "audio/webm",
    "original_filename": "voice-note.webm",
    "original_size": 245678,
    "converted_format": "audio/ogg",
    "converted_filename": "voice-note.ogg",
    "converted_size": 189234,
    "compression_ratio": "22.97%"
  }
}
```

If no conversion was needed (audio/ogg sent directly), `audio_conversion` field will not be present.

## Error Handling

Backend will return error if conversion fails:

```json
{
  "error": "Failed to upload and send media",
  "message": "Audio conversion failed: FFmpeg error details. Original format: audio/webm"
}
```

**Common causes:**
- Corrupted audio file
- Unsupported codec variant
- Server ffmpeg not properly installed

## Fallback Strategy (Optional)

If you want to optimize and avoid server conversion, use this fallback order:

```javascript
function getSupportedAudioMimeType() {
  const types = [
    'audio/ogg;codecs=opus',    // Best - no conversion needed
    'audio/mp4',                 // Good - no conversion needed  
    'audio/mpeg',                // Good - no conversion needed
    'audio/webm;codecs=opus'     // OK - backend will convert
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  // Fallback to default - backend will handle conversion
  return undefined;
}

const mimeType = getSupportedAudioMimeType();
const mediaRecorder = new MediaRecorder(stream, 
  mimeType ? { mimeType } : undefined
);
```

## Backend Technical Details

### Conversion Specifications:
- **Codec:** libopus (Opus codec for OGG container)
- **Bitrate:** 128kbps (optimal for voice)
- **Channels:** Mono (1 channel - sufficient for voice)
- **Sample Rate:** 48kHz (Opus standard)
- **Container:** OGG

### FFmpeg Command (Equivalent):
```bash
ffmpeg -i input.webm \
  -c:a libopus \
  -b:a 128k \
  -ac 1 \
  -ar 48000 \
  -f ogg \
  output.ogg
```

## Testing Your Implementation

```javascript
// Test with different formats
const testFormats = [
  { type: 'audio/ogg', shouldConvert: false },
  { type: 'audio/webm', shouldConvert: true },
  { type: 'audio/mp4', shouldConvert: false }
];

for (const test of testFormats) {
  console.log(`Testing ${test.type}...`);
  
  const response = await fetch('/api/messages/send-media-combined', {
    method: 'POST',
    body: createFormDataWithAudio(test.type)
  });
  
  const result = await response.json();
  
  if (result.audio_conversion) {
    console.log('✅ Converted:', result.audio_conversion);
  } else {
    console.log('✅ No conversion needed - native format');
  }
}
```

## References

- [WhatsApp Cloud API Media Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
