# Audio Format Guide for WhatsApp Integration

## Supported Audio Formats

WhatsApp Cloud API **ONLY** supports the following audio formats:
- ✅ **audio/ogg** (with Opus codec) - **RECOMMENDED** for web voice recordings
- ✅ **audio/aac** - Good quality, widely supported
- ✅ **audio/mp4** - M4A format
- ✅ **audio/mpeg** - MP3 format
- ✅ **audio/amr** - Adaptive Multi-Rate (mobile)

## Unsupported Formats

- ❌ **audio/webm** - NOT supported by WhatsApp API
- ❌ **audio/wav** - NOT supported by WhatsApp API

## Frontend Implementation: Converting WebM to OGG

When recording audio in the browser using MediaRecorder API, you must specify the correct MIME type:

### ❌ WRONG - This will fail:
```javascript
const mediaRecorder = new MediaRecorder(stream);
// Default might be audio/webm on Chrome
```

### ✅ CORRECT - Use audio/ogg:
```javascript
// Check if browser supports audio/ogg with opus codec
const mimeType = 'audio/ogg;codecs=opus';

if (!MediaRecorder.isTypeSupported(mimeType)) {
  console.error('Browser does not support audio/ogg');
  // Fallback to audio/mp4 or audio/mpeg
}

const mediaRecorder = new MediaRecorder(stream, {
  mimeType: mimeType,
  audioBitsPerSecond: 128000 // 128kbps - good quality
});

const audioChunks = [];

mediaRecorder.addEventListener('dataavailable', (event) => {
  audioChunks.push(event.data);
});

mediaRecorder.addEventListener('stop', async () => {
  const audioBlob = new Blob(audioChunks, { type: mimeType });
  
  // Create File object to send to backend
  const audioFile = new File([audioBlob], 'voice-note.ogg', { 
    type: mimeType 
  });
  
  // Send to backend
  const formData = new FormData();
  formData.append('media', audioFile);
  formData.append('to', phoneNumber);
  formData.append('user_id', userId);
  
  const response = await fetch('/api/messages/send-media-combined', {
    method: 'POST',
    body: formData
  });
});
```

## Browser Compatibility

| Browser | audio/ogg Support | Alternative |
|---------|------------------|-------------|
| Chrome 49+ | ✅ Yes (opus codec) | - |
| Firefox 25+ | ✅ Yes (opus codec) | - |
| Safari 14.1+ | ✅ Yes (opus codec) | Use audio/mp4 for older versions |
| Edge 79+ | ✅ Yes (opus codec) | - |

## Fallback Strategy

If the browser doesn't support audio/ogg, use this fallback order:

```javascript
function getSupportedAudioMimeType() {
  const types = [
    'audio/ogg;codecs=opus',    // Best for WhatsApp
    'audio/mp4',                 // Good fallback
    'audio/mpeg',                // MP3 fallback
    'audio/webm;codecs=opus'     // Last resort (will need server conversion)
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  throw new Error('No supported audio format found');
}

const mimeType = getSupportedAudioMimeType();
const mediaRecorder = new MediaRecorder(stream, { mimeType });
```

## Converting WebM to OGG (Server-Side)

⚠️ **NOT CURRENTLY IMPLEMENTED** - Backend does NOT convert audio formats.

If you need server-side conversion, you would need to:
1. Install `fluent-ffmpeg` package
2. Install `ffmpeg` binary in the container/server
3. Convert audio on upload

**This adds complexity and latency. It's better to send the correct format from frontend.**

## Error Handling

If backend rejects audio/webm, you'll receive:

```json
{
  "error": "WhatsApp does not support audio/webm format. Please convert to audio/ogg (recommended) or audio/mp4 before uploading."
}
```

Frontend should:
1. ✅ Always use audio/ogg for voice recordings
2. ✅ Check MIME type support before recording
3. ✅ Show user-friendly error if recording fails
4. ✅ Implement fallback to audio/mp4 if audio/ogg not supported

## Testing Your Implementation

```javascript
// Test if your audio blob has correct MIME type
console.log('Audio MIME type:', audioBlob.type);
// Should output: "audio/ogg;codecs=opus" or "audio/ogg"

// Verify before sending
if (!audioBlob.type.startsWith('audio/ogg') && 
    !audioBlob.type.startsWith('audio/mp4') &&
    !audioBlob.type.startsWith('audio/aac')) {
  console.error('Invalid audio format:', audioBlob.type);
  alert('Please use a supported audio format');
  return;
}
```

## References

- [WhatsApp Cloud API Media Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
