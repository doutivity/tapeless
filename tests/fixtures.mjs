import { createProfile } from '../assets/js/state.js';

export const CARDS = {
  interests: { teaching: 'навчати', analysis: 'аналізувати дані', programming: 'програмування', writing: 'писати', design: 'дизайн' },
  skills: { explaining: 'пояснювати', logic: 'логічно мислити', 'writing-skill': 'писати тексти' },
};

export function fullProfile(over = {}) {
  const p = createProfile();
  p.interests = { text: 'розбиратись, як усе влаштоване', cards: ['teaching', 'analysis', 'programming'] };
  p.skills = { text: 'швидко вчуся', cards: [{ id: 'explaining', level: 2 }, { id: 'logic', level: 3 }, { id: 'writing-skill', level: 1 }] };
  p.languages = [{ code: 'uk', level: 4, name: '' }, { code: 'en', level: 2, name: '' }, { code: 'other', level: 1, name: 'польська' }];
  p.education = 'бакалавр, економіка';
  p.experience = 'рік у підтримці клієнтів';
  p.person = { gender: 'unspecified', age: '24', location: 'Львів', relocate: 'ukraine', remote: 'yes', military: 'unspecified' };
  p.conditions = {
    balance: 4, study: 'short', risk: 'safe', stress: 'low', mode: 'remote', team: 'either', schedule: 'stable', workType: 'mental', publicity: 'maybe',
    income: { min: '25 000 грн', target: '60 000 грн', horizonMonths: 6 }, capital: 'small', blogging: 'curious', aiPriority: 5,
  };
  p.extra = 'не можу працювати вночі';
  return Object.assign(p, over);
}
