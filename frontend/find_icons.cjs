const lucide = require('lucide-react');
const keys = Object.keys(lucide);
const github = keys.filter(k => k.toLowerCase().includes('github'));
const linkedin = keys.filter(k => k.toLowerCase().includes('linkedin'));
console.log('GitHub icons:', github);
console.log('LinkedIn icons:', linkedin);
