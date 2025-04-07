"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const authMiddleware = (req, res, next) => {
    // TEMPORARY BYPASS: Authentication is temporarily disabled
    // Set a hard-coded user object with a valid UUID to ensure DB queries work
    req.user = {
        id: '1510e5d3-e491-4ebd-b22e-595f42b663da',
        org_id: '75a7c5e3-567c-4cc2-ba1a-a12774aa0406',
        name: 'temp-user',
        org_name: 'temp-organization',
        wallet_created: false,
        private_key_viewed: false,
        wallet_public_key: '',
        wallet_private_key: '',
        openai_api_key: process.env.OPENAI_API_KEY || '',
    };
    // Proceed to the protected route
    next();
    /* ORIGINAL AUTH CODE - COMMENTED OUT TEMPORARILY
    const cookieToken = req.cookies?.token; // Using cookie-parser
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
  
    const token = cookieToken || headerToken;
    
    if (!token) {
      res.status(401).json({ message: 'No token, authorization denied' });
      return;
    }
  
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as DecodedToken;
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Token is not valid' });
      return;
    }
    */
};
exports.authMiddleware = authMiddleware;
