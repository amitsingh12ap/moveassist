const multer = require('multer');
const path = require('path');

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images allowed'));
  }
};

let storage;

if (process.env.S3_BUCKET_NAME) {
  const multerS3 = require('multer-s3');
  const AWS = require('aws-sdk');

  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  storage = multerS3({
    s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: 'public-read',
    key: (req, file, cb) => {
      const folder = req.params.id || 'general';
      const filename = `furniture/${folder}/${Date.now()}-${file.originalname}`;
      cb(null, filename);
    },
  });
} else {
  console.warn('S3_BUCKET_NAME not set — falling back to local disk storage (uploads/)');
  storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const folder = req.params.id || 'general';
      cb(null, `${folder}-${Date.now()}${path.extname(file.originalname)}`);
    },
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter,
});

module.exports = upload;
