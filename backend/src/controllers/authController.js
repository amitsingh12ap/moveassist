const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../../config/db');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, phone } = req.body;
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ($1,$2,$3,$4,'customer') RETURNING id, name, email, role`,
      [name, email, hash, phone]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { emailOrPhone, password } = req.body;
  try {
    // Support login with email OR phone number
    // Check if input looks like a phone number (contains + or starts with digits)
    const isPhone = /^[\d+\-\s()]+$/.test(emailOrPhone);
    
    let result;
    if (isPhone) {
      // Clean phone number: remove spaces, dashes, parentheses
      const cleanPhone = emailOrPhone.replace(/[\s\-()]/g, '');
      result = await db.query(
        'SELECT id, name, email, role, password_hash FROM users WHERE phone = $1',
        [cleanPhone]
      );
    } else {
      // Login with email
      result = await db.query(
        'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
        [emailOrPhone]
      );
    }
    
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
};
