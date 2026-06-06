import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const authUri = 'mongodb+srv://trade-x:Devashish%4010@cluster0.9fcja5p.mongodb.net/auth-db';

const userSchema = new mongoose.Schema({ 
  email: String,
  passwordHash: String
}, { collection: 'users' });

async function run() {
  try {
    const authConn = await mongoose.createConnection(authUri).asPromise();
    const User = authConn.model('User', userSchema);
    
    const email = 'newuser@gmail.com';
    const plainPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(plainPassword, salt);

    const result = await User.findOneAndUpdate(
      { email },
      { $set: { passwordHash } },
      { new: true }
    );

    if (result) {
      console.log(`Successfully updated password for ${email}. You can now log in with password: ${plainPassword}`);
    } else {
      console.log(`User ${email} not found.`);
    }

    await authConn.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
