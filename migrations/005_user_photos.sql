ALTER TABLE users ADD COLUMN profile_photo_upload_id TEXT REFERENCES uploads(id) ON DELETE SET NULL;
