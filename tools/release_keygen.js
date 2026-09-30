'use strict';
/* Создает пару ключей для подписи релизов Жолдас (Ed25519).
   Запуск на вашем компьютере:  node tools/release_keygen.js [каталог]
   - release.key: СЕКРЕТНЫЙ ключ. Никому не отправляйте, не кладите в репозиторий. Его содержимое нужно добавить в секреты GitHub (RELEASE_SIGNING_KEY).
   - release.pub: публичный ключ. Его ставят на сервер один раз:  sudo joldas-set-release-key < release.pub
   После этого сервер будет устанавливать только релизы, подписанные вашим ключом. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(process.argv[2] || 'joldas-release-key');
if (fs.existsSync(path.join(dir, 'release.key'))) { console.error('В ' + dir + ' ключ уже есть, ничего не меняю.'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(path.join(dir, 'release.key'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(path.join(dir, 'release.pub'), publicKey.export({ type: 'spki', format: 'pem' }));
console.log('Готово: ' + dir);
console.log('1) GitHub -> репозиторий -> Settings -> Secrets and variables -> Actions -> New repository secret: имя RELEASE_SIGNING_KEY, значение - весь текст файла release.key');
console.log('2) На сервере (консоль): sudo joldas-set-release-key < release.pub   (файл release.pub перенесите на сервер)');
console.log('3) Храните release.key в надежном месте (менеджер паролей). Если он потерян, ключ на сервере заменяют той же командой.');
