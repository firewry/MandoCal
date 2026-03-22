const ALL_EPISODES = [];
['S1', 'S2'].forEach(s => { for(let i=1; i<=8; i++) ALL_EPISODES.push(s+'E'+i); });
for(let i=1; i<=7; i++) ALL_EPISODES.push('BoBFE'+i);
for(let i=1; i<=8; i++) ALL_EPISODES.push('S3E'+i);

const PAST_WATCHED = {
  '2026-03-16': ['S1E1'], '2026-03-17': ['S1E2'], '2026-03-18': ['S1E3'],
  '2026-03-19': ['S1E4'], '2026-03-21': ['S1E5']
};

let userModifiers = {}; // e.g., '2026-03-25': 1 (added one extra eps) or -1 (removed one)

let currentDate = new Date(2026, 2, 1); // target month
const today = new Date(2026, 2, 21); // today
const movieDate = new Date(2026, 4, 22); // May 22

function formatDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

// Generate valid schedule dates array
function getValidDates() {
    let dates = [];
    let start = new Date(2026, 2, 22); // Day after today
    let end = new Date(2026, 4, 21); // Day before movie
    for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        let fDate = formatDate(d);
        // Is it a Friday?
        if (d.getDay() === 5) { dates.push(fDate); continue; }
        
        // Alternate weeks logic (simplification based on prompt: 3/22-3/26 = no plan)
        // Let's do a simple calculation: weeks alternate.
        // We'll calculate week number from 3/22 (Sunday)
        const diffTime = d - new Date(2026, 2, 22); // diff from 3/22
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7);
        // week 0 (3/22-3/28) = no plan (except friday, handled)
        // week 1 (3/29-4/4) = plan 
        if (weekNum % 2 !== 0) {
            dates.push(fDate);
        }
    }
    return dates.sort(); // these are all valid dates forward
}

function calculateSchedule() {
    let schedule = JSON.parse(JSON.stringify(PAST_WATCHED));
    let validDates = getValidDates();
    let remainingEps = ALL_EPISODES.slice(5); // remaining 26
    
    // Total valid slots:
    let slotCapacity = {};
    validDates.forEach(d => {
        let base = 1;
        let mod = userModifiers[d] || 0;
        let cap = Math.max(0, base + mod);
        slotCapacity[d] = cap;
    });

    // distribute backwards
    let remainingSlots = Object.values(slotCapacity).reduce((a,b)=>a+b, 0);
    let neededEps = remainingEps.length;

    // if neededEps > remainingSlots, we need to add slots backwards 2,1,2,1
    let extraNeeded = neededEps - remainingSlots;
    if(extraNeeded > 0) {
        let reversedDates = [...validDates].reverse();
        let toggle = true; // 2, then 1, then 2
        let added = 0;
        let pDate = 0;
        while(added < extraNeeded && pDate < reversedDates.length) {
            let d = reversedDates[pDate];
            let additional = toggle ? 1 : 0;
            slotCapacity[d] += additional;
            added += additional;
            toggle = !toggle;
            if(pDate === reversedDates.length - 1 && added < extraNeeded) {
                pDate = 0; // wrap around just in case
            } else {
                pDate++;
            }
        }
    }

    // Now assign
    validDates.forEach(d => {
        let cap = slotCapacity[d];
        for(let i=0; i<cap; i++) {
            if(remainingEps.length > 0) {
                if(!schedule[d]) schedule[d] = [];
                schedule[d].push(remainingEps.shift());
            }
        }
    });

    return schedule;
}

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

function renderCalendar() {
  const schedule = calculateSchedule();
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  document.getElementById('current-month-display').innerText = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);
  
  for(let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + i + 1;
    grid.appendChild(createDayCell(new Date(year, month - 1, d), false, schedule));
  }
  
  for(let i = 1; i <= daysInMonth; i++) {
    grid.appendChild(createDayCell(new Date(year, month, i), true, schedule));
  }
  
  const remaining = 42 - (firstDay + daysInMonth);
  for(let i = 1; i <= remaining; i++) {
    grid.appendChild(createDayCell(new Date(year, month + 1, i), false, schedule));
  }
}

function getStyleClass(ep) {
    if(ep.startsWith('S1')) return '';
    if(ep.startsWith('S2')) return 's2';
    if(ep.startsWith('BoBF')) return 'bobf';
    if(ep.startsWith('S3')) return 's3';
    return '';
}

function adjustEpisode(dateStr, change) {
  if (new Date(dateStr) <= today) return; // can't change past
  userModifiers[dateStr] = (userModifiers[dateStr] || 0) + change;
  renderCalendar();
};

function createDayCell(date, isCurrentMonth, schedule) {
  const cell = document.createElement('div');
  cell.className = 'day-cell' + (!isCurrentMonth ? ' not-current-month' : '');
  const dateStr = formatDate(date);
  if(dateStr === formatDate(today)) cell.classList.add('today');
  
  const num = document.createElement('div');
  num.className = 'date-number';
  num.innerText = date.getDate();
  cell.appendChild(num);
  
  if (date > today) {
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = "<button onclick='adjustEpisode(\"" + dateStr + "\", 1)'>+</button><button onclick='adjustEpisode(\"" + dateStr + "\", -1)'>-</button>";
    cell.appendChild(controls);
  }
  
  const eps = document.createElement('div');
  eps.className = 'episodes-container';
  (schedule[dateStr] || []).forEach(ep => {
    const el = document.createElement('div');
    el.className = 'episode ' + getStyleClass(ep) + (date <= today ? ' watched' : '');
    el.innerText = ep;
    eps.appendChild(el);
  });
  cell.appendChild(eps);
  return cell;
}

document.getElementById('prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
document.getElementById('today-btn').onclick = () => { currentDate = new Date(today); renderCalendar(); };

renderCalendar();
