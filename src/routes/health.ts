import express, { Request, Response } from 'express';

const router = express.Router();

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', function (req: Request, res: Response) {
  res.status(200).json({
    status: 'OK',
    message: 'El servidor está funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

export default router; 