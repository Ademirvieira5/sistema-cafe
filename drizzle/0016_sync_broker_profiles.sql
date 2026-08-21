INSERT OR IGNORE INTO brokers (
  id, person_type, name, trade_name, cpf_cnpj, rg_ie, email, phone,
  pix_key, notes, active, created_at, updated_at
)
SELECT
  p.id, p.person_type, p.legal_name, p.trade_name, p.cpf_cnpj, p.rg_ie,
  p.email, p.phone, NULL, p.notes, p.active, p.created_at, p.updated_at
FROM people p
JOIN person_roles pr ON pr.person_id = p.id AND pr.role = 'BROKER';
--> statement-breakpoint
UPDATE brokers
SET
  person_type = (SELECT p.person_type FROM people p WHERE p.id = brokers.id),
  name = (SELECT p.legal_name FROM people p WHERE p.id = brokers.id),
  trade_name = (SELECT p.trade_name FROM people p WHERE p.id = brokers.id),
  cpf_cnpj = (SELECT p.cpf_cnpj FROM people p WHERE p.id = brokers.id),
  rg_ie = (SELECT p.rg_ie FROM people p WHERE p.id = brokers.id),
  email = (SELECT p.email FROM people p WHERE p.id = brokers.id),
  phone = (SELECT p.phone FROM people p WHERE p.id = brokers.id),
  notes = (SELECT p.notes FROM people p WHERE p.id = brokers.id),
  active = (SELECT p.active FROM people p WHERE p.id = brokers.id),
  updated_at = (SELECT p.updated_at FROM people p WHERE p.id = brokers.id)
WHERE id IN (SELECT person_id FROM person_roles WHERE role = 'BROKER');
