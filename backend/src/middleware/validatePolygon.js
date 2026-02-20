/**
 * Validate Polygon Middleware
 * Ensures polygon is present in request body for analysis endpoints
 */

export function validatePolygon(req, res, next) {
  const { polygon } = req.body;
  if (!polygon) {
    return res.status(400).json({ 
      error: 'polygon is required (GeoJSON Polygon or MultiPolygon)' 
    });
  }
  next();
}

