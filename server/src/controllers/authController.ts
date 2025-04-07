import { NextFunction, Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { generateToken } from '../utils/jwt';
import { APP_CONFIG } from '../config/appConfig';
import { AppError } from '../middleware/errorHandler';
import { getValidBetaCodes } from '../utils/betaCodes';

export const register: RequestHandler = async (req, res) => {
  const { username, password, organisation, description, code, openAiApiKey } = req.body;

  if (!code) {
    res.status(200).json({ success: false, message: 'Registration code is required' });
    return;
  }
  
  const validCodes = getValidBetaCodes();
  console.log("validCodes", validCodes);
  if (!validCodes.has(code)) {
    res.status(200).json({ success: false, message: 'Invalid registration code' });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query(
        'SELECT * FROM Organisation WHERE name = $1',
        [organisation]
      );

      let orgId: string;

      if (orgResult.rows.length > 0) {
        const userResult = await client.query(
          'SELECT * FROM Creator WHERE username = $1 AND org_id = $2',
          [username, orgResult.rows[0].id]
        );

        if (userResult.rows.length > 0) {
          res.status(400).json({ message: 'Username already exists in this organisation' });
          return;
        }

        orgId = orgResult.rows[0].id;
      } else {
        orgId = uuidv4();
        await client.query(
          'INSERT INTO Organisation (id, name, description) VALUES ($1, $2, $3)',
          [orgId, organisation, description]
        );
      }

      const salt = await bcrypt.genSalt(APP_CONFIG.PASSWORD_SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userId = uuidv4();
      await client.query(
        'INSERT INTO Creator (id, username, password, org_id, role, openAiApiKey) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, username, hashedPassword, orgId, 'admin', openAiApiKey]
      );

      await client.query('COMMIT');

      const token = generateToken({
        id: userId,
        org_id: orgId,
        name: username,
        org_name: organisation,
        openai_api_key: openAiApiKey,
      });

      res.status(201)
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
        })
        .json({
          success: true,
          message: 'User registered successfully',
          token,
          user: { 
            id: userId, 
            username, 
            org_id: orgId, 
            org_name: organisation,
            role: 'admin',
            openai_api_key: openAiApiKey,
          },
        });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const login: RequestHandler = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT Creator.*, Organisation.name as org_name FROM Creator JOIN Organisation ON Creator.org_id = Organisation.id WHERE Creator.username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }
    
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      id: user.id,
      org_id: user.org_id,
      name: user.username,
      org_name: user.org_name,
      openai_api_key: user.openaiapikey,
    });

    // Set an HTTP-only cookie containing the token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day in ms
    });

    res.json({
      message: 'success',
      token,
      user: {
        id: user.id,
        username: user.username,
        org_id: user.org_id,
        org_name: user.org_name,
        role: user.role,
        openai_api_key: user.openaiapikey,
      },
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout: RequestHandler = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

export const getUser: RequestHandler = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      res.status(401).json({ message: 'Unauthorized: No user data' });
      return;
    }

    const result = await pool.query('SELECT * FROM Creator WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const user = result.rows[0];

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        org_id: user.org_id,
        org_name: user.org_name,
        openai_api_key: user.openaiapikey,
      },
    });
  } catch (error) {
    console.error('Error retrieving user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateApiKey: RequestHandler = async (req, res, next) => {
  const userId = req.user?.id;
  const { apiKey } = req.body;

  if (!userId) {
    next(new AppError('User ID not found', 400));
    return;
  }

  if (!apiKey) {
    next(new AppError('API key is required', 400));
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE Creator SET openaiapikey = $1 WHERE id = $2 RETURNING openaiapikey',
      [apiKey, userId]
    );

    if (result.rowCount === 0) {
      throw new AppError('User not found or API key not updated', 404);
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'API key updated successfully',
      openAiApiKey: result.rows[0].openaiapikey,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating API key:', error);
    next(new AppError('Failed to update API key', 500));
  } finally {
    client.release();
  }
};
