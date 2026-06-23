-- Seed data for live courier tracking system

-- Insert default admin user: admin@kuryetakip.com / Admin123!
-- The password hash is generated using bcrypt with 10 salt rounds for 'Admin123!'
INSERT INTO admins (email, password_hash)
VALUES ('admin@kuryetakip.com', '$2a$10$sbY2VNUiSP2BCe7y4tg.DuChmLlsgE1adCW4CyzgscVZvJBwOuyQ.')
ON CONFLICT (email) DO NOTHING;

