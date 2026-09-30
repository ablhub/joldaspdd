'use strict';
/* Язык ответов API для учеников: заголовок X-Lang (ru|kk|en) и перевод сообщений с русского.
   Сообщения в коде пишутся по-русски; tr() подставляет перевод по точному совпадению строки.
   Админка остается на русском: ее ответы не переводятся. */

const LANGS = ['ru', 'kk', 'en'];

/* 'kk', 'KK', 'kk-KZ', 'en_US' -> код языка сайта; иначе null */
function normLang(v) {
  const m = /^([a-z]{2})(?:[-_][a-z0-9-]*)?$/.exec(String(v == null ? '' : v).trim().toLowerCase());
  return m && LANGS.includes(m[1]) ? m[1] : null;
}
function reqLang(req) {
  return normLang(req && req.headers && req.headers['x-lang']) || 'ru';
}

/* ru -> [kk, en]. Ключи совпадают с текстами в validate.js, users.js, util.js, main.js символ в символ */
const DICT = {
  'Войдите в аккаунт': ['Аккаунтқа кіріңіз', 'Please log in'],
  'Сессия завершена, войдите снова': ['Сеанс аяқталды, қайта кіріңіз', 'Your session has ended, please log in again'],
  'Сессия истекла, войдите снова': ['Сеанс мерзімі бітті, қайта кіріңіз', 'Your session has expired, please log in again'],
  'Аккаунт заблокирован. Обратитесь в поддержку': ['Аккаунт бұғатталған. Қолдау қызметіне хабарласыңыз', 'Your account is blocked. Please contact support'],
  'Задайте новый пароль, чтобы продолжить': ['Жалғастыру үшін жаңа құпиясөз орнатыңыз', 'Set a new password to continue'],
  'Не удалось зарегистрироваться': ['Тіркелу мүмкін болмады', 'Registration failed'],
  'Нужно согласие на обработку персональных данных': ['Дербес деректерді өңдеуге келісім қажет', 'Consent to the processing of personal data is required'],
  'До 18 лет нужно согласие родителя или законного представителя': ['18 жасқа дейін ата-ананың немесе заңды өкілдің келісімі қажет', 'Under 18, consent of a parent or legal guardian is required'],
  'Этот номер уже зарегистрирован. Войдите по номеру и паролю': ['Бұл нөмір тіркелген. Нөмір мен құпиясөз арқылы кіріңіз', 'This number is already registered. Log in with your number and password'],
  'Этот телефон уже у другого пользователя': ['Бұл телефон нөмірі басқа пайдаланушыда тіркелген', 'This phone number belongs to another user'],
  'Проверьте номер телефона': ['Телефон нөмірін тексеріңіз', 'Check the phone number'],
  'Слишком много неудачных попыток. Попробуйте через 15 минут или обратитесь в поддержку': ['Сәтсіз әрекеттер тым көп. 15 минуттан кейін қайталаңыз немесе қолдау қызметіне хабарласыңыз', 'Too many failed attempts. Try again in 15 minutes or contact support'],
  'Неверный телефон или пароль': ['Телефон немесе құпиясөз қате', 'Wrong phone number or password'],
  'Некорректный результат': ['Нәтиже қате', 'Invalid result'],
  'Для возраста до 18 лет нужно согласие родителя или законного представителя. Напишите в поддержку': ['18 жасқа дейін ата-ананың немесе заңды өкілдің келісімі қажет. Қолдау қызметіне жазыңыз', 'Under 18, consent of a parent or legal guardian is required. Please write to support'],
  'Согласие на рекламные сообщения можно дать с 18 лет': ['Жарнамалық хабарламаларға келісімді 18 жастан бастап беруге болады', 'Consent to marketing messages can be given from the age of 18'],
  'Текущий пароль неверный': ['Қазіргі құпиясөз қате', 'The current password is wrong'],
  'Неверный пароль': ['Құпиясөз қате', 'Wrong password'],
  'Аккаунт удален': ['Аккаунт жойылды', 'The account has been deleted'],
  'Слишком большой запрос': ['Сұраныс тым үлкен', 'Request too large'],
  'Некорректный JSON': ['JSON қате', 'Invalid JSON'],
  'Некорректный запрос': ['Сұраныс қате', 'Invalid request'],
  'Слишком много попыток, попробуйте через несколько минут': ['Әрекеттер тым көп, бірнеше минуттан кейін қайталаңыз', 'Too many attempts, try again in a few minutes'],
  'Укажите имя': ['Атыңызды жазыңыз', 'Enter your first name'],
  'Укажите фамилию': ['Тегіңізді жазыңыз', 'Enter your last name'],
  'Имя: не длиннее 40 символов': ['Аты: 40 таңбадан аспауы керек', 'First name: 40 characters maximum'],
  'Фамилию: не длиннее 40 символов': ['Тегі: 40 таңбадан аспауы керек', 'Last name: 40 characters maximum'],
  'Имя: только буквы, пробел, дефис и апостроф': ['Аты: тек әріптер, бос орын, дефис және апостроф', 'First name: letters, spaces, hyphens and apostrophes only'],
  'Фамилию: только буквы, пробел, дефис и апостроф': ['Тегі: тек әріптер, бос орын, дефис және апостроф', 'Last name: letters, spaces, hyphens and apostrophes only'],
  'Телефон в формате +7 7XX XXX XX XX': ['Телефон +7 7XX XXX XX XX форматында болуы керек', 'Phone number in the format +7 7XX XXX XX XX'],
  'Укажите дату рождения': ['Туған күніңізді көрсетіңіз', 'Enter your date of birth'],
  'Проверьте дату рождения': ['Туған күнді тексеріңіз', 'Check the date of birth'],
  'Регистрация доступна с 14 лет': ['Тіркелу 14 жастан бастап қолжетімді', 'Registration is available from the age of 14'],
  'Выберите категорию': ['Санатты таңдаңыз', 'Choose a category'],
  'Пароль не короче 8 символов': ['Құпиясөз кемінде 8 таңбадан тұруы керек', 'The password must be at least 8 characters'],
  'Пароль не длиннее 128 символов': ['Құпиясөз 128 таңбадан аспауы керек', 'The password must be 128 characters or fewer'],
  'Пароль слишком простой': ['Құпиясөз тым қарапайым', 'The password is too simple'],
  'Запрос отклонен': ['Сұраныс қабылданбады', 'Request rejected'],
  'Не найдено': ['Табылмады', 'Not found'],
  'Ошибка сервера': ['Сервер қатесі', 'Server error'],
  // добавлено к таблице задачи: неверный lang в PATCH /api/v1/me (в стиле «Выберите категорию»)
  'Выберите язык': ['Тілді таңдаңыз', 'Choose a language'],
};

function tr(message, lang) {
  if (lang !== 'kk' && lang !== 'en') return message;
  const t = Object.prototype.hasOwnProperty.call(DICT, message) ? DICT[message] : null;
  return t ? t[lang === 'kk' ? 0 : 1] : message;
}

module.exports = { LANGS, normLang, reqLang, tr, DICT };
