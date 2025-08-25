ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_wa_message_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_emoji TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction_to_wa_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_wa_message_id ON messages(reply_to_wa_message_id) WHERE reply_to_wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reaction_emoji ON messages(reaction_emoji) WHERE reaction_emoji IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reaction_to_wa_message_id ON messages(reaction_to_wa_message_id) WHERE reaction_to_wa_message_id IS NOT NULL;