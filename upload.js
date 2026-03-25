const Client = require('ssh2-sftp-client');
const sftp = new Client();

async function upload() {
  try {
    console.log('Connecting to SFTP...');
    await sftp.connect({
      host: '162.243.67.28',
      port: 2022,
      username: 'admin.05053ca4',
      password: 'KAmaterasu!(47)o'
    });
    console.log('Uploading bot.zip...');
    await sftp.fastPut('bot.zip', '/bot.zip');
    const stats = await sftp.stat('/bot.zip');
    console.log(`Upload complete! Remote size: ${stats.size} bytes`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    sftp.end();
  }
}

upload();
