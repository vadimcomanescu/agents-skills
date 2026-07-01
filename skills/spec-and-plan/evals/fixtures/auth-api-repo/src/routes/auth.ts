import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticates a user with email and password.
 * No rate limiting currently applied.
 */
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // TODO: validate credentials against database
  // Stub: always returns 401 for fixture purposes
  return res.status(401).json({ error: 'Invalid credentials' });
});

/**
 * POST /api/auth/logout
 * Terminates the current session.
 */
router.post('/logout', (req: Request, res: Response) => {
  return res.status(200).json({ message: 'Logged out' });
});

export default router;
