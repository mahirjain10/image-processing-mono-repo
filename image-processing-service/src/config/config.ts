// console.log(process.env)
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  db: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.EXPIRES_IN,
  },
  env: process.env.ENV || 'development',
  aws:{
    region:process.env.AWS_REGION,
    bucket:process.env.AWS_BUCKET_NAME,
    accessKeyId:process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY
  }
});
