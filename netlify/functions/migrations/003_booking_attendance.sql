ALTER TABLE attendance ADD COLUMN student_id TEXT REFERENCES users(id);
ALTER TABLE attendance ADD COLUMN learning_session_id TEXT REFERENCES learning_sessions(id);
ALTER TABLE tutor_active_sessions ADD COLUMN student_id TEXT REFERENCES users(id);
ALTER TABLE tutor_active_sessions ADD COLUMN learning_session_id TEXT REFERENCES learning_sessions(id);
INSERT OR IGNORE INTO tutor_details(user_id,tenant_id,university,major,education_level,experience_years,verification_status,verified_at)
SELECT id,'default','','','',0,CASE WHEN status='active' THEN 'verified' ELSE 'pending' END,CASE WHEN status='active' THEN created_at ELSE NULL END FROM users WHERE role='tutor';
INSERT OR IGNORE INTO student_profiles(user_id,tenant_id) SELECT id,'default' FROM users WHERE role='student';
