import fs from 'node:fs'

const FILE = new URL('../data/db.json', import.meta.url)
const db = JSON.parse(fs.readFileSync(FILE, 'utf8'))

const images = {
  'i-01': 'https://commons.wikimedia.org/wiki/Special:FilePath/Misir%20Wot%20and%20Gomen%20Besiga%20-%20Abyssinia%2C%20Brighton.jpg?width=420',
  'i-02': 'https://commons.wikimedia.org/wiki/Special:FilePath/Kitfo%20(Ethiopian%20Tartar).jpg?width=420',
  'i-03': 'https://commons.wikimedia.org/wiki/Special:FilePath/Injera%20and%20doro%20wat.jpg?width=420',
  'i-04': 'https://commons.wikimedia.org/wiki/Special:FilePath/Ethiopian%20wat.jpg?width=420',
  'i-05': 'https://commons.wikimedia.org/wiki/Special:FilePath/Fastenessen%20fasting%20meal.JPG?width=420',
  'i-06': 'https://commons.wikimedia.org/wiki/Special:FilePath/Taita%20and%20shiro.jpg?width=420',
  'i-07': 'https://commons.wikimedia.org/wiki/Special:FilePath/Cheeseburger.jpg?width=420',
  'i-08': 'https://commons.wikimedia.org/wiki/Special:FilePath/Coffee%20ceremony%20of%20Ethiopia%20and%20Eritrea%201.jpg?width=420',
  'i-09': 'https://commons.wikimedia.org/wiki/Special:FilePath/Latte%20macchiato%20with%20coffee%20beans.jpg?width=420',
  'i-10': 'https://commons.wikimedia.org/wiki/Special:FilePath/Cappuccino%208.jpg?width=420',
  'i-11': 'https://commons.wikimedia.org/wiki/Special:FilePath/2019%20Jan%2016%20-%20Kumbh%20Mela%20-%20Chai.jpg?width=420',
  'i-12': 'https://commons.wikimedia.org/wiki/Special:FilePath/Avocado%20lamaw%20(Avocado%20in%20milk%20and%20sugar%2C%20chilled%20or%20with%20ice)%2C%20Philippines%2004.jpg?width=420',
  'i-13': 'https://commons.wikimedia.org/wiki/Special:FilePath/Mangos%20-%20single%20and%20halved.jpg?width=420',
  'i-14': 'https://commons.wikimedia.org/wiki/Special:FilePath/Orange%20juice%201%20edit1.jpg?width=420',
  'i-15': 'https://commons.wikimedia.org/wiki/Special:FilePath/Lemonade%202.jpg?width=420',
  'i-16': 'https://commons.wikimedia.org/wiki/Special:FilePath/Beer%20wuerzburger%20hofbraue%20v.jpg?width=420',
  'i-17': 'https://commons.wikimedia.org/wiki/Special:FilePath/Von%20Trapp%20beer%20glass%20with%20beer%202021%20001.jpg?width=420',
  'i-18': 'https://commons.wikimedia.org/wiki/Special:FilePath/A%20glass%20of%20Ethiopian%20mead%20(tej).jpg?width=420',
  'i-19': 'https://commons.wikimedia.org/wiki/Special:FilePath/White%20Wine%20Glas.jpg?width=420',
  'i-20': 'https://commons.wikimedia.org/wiki/Special:FilePath/15-09-26-RalfR-WLC-0098%20-%20Coca-Cola%20glass%20bottle%20(Germany).jpg?width=420',
  'i-21': 'https://commons.wikimedia.org/wiki/Special:FilePath/Photo%20of%20canned%20spring%20water.%2016%20oz%20reclosable%20aluminum%20bottle.jpg?width=420',
  'i-22': 'https://commons.wikimedia.org/wiki/Special:FilePath/Ethiopian%20cuisine%20fusion.jpg?width=420',
  'i-23': 'https://commons.wikimedia.org/wiki/Special:FilePath/Injera%20and%20doro%20wat%20-%2049337093131.jpg?width=420',
}

let updated = 0
for (const item of db.items) {
  if (images[item.id]) {
    item.image = images[item.id]
    updated += 1
  }
}

fs.writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n', 'utf8')
console.log(`updated ${updated} items; total items ${db.items.length}`)