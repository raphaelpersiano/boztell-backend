ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_wa_message_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_emoji TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_to_wa_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_content_type ON messages(content_type);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_wa ON messages(reply_to_wa_message_id) WHERE reply_to_wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reaction_to_wa ON messages(reaction_to_wa_message_id) WHERE reaction_to_wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_media_id ON messages(media_id) WHERE media_id IS NOT NULL;
