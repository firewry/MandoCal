const firebaseConfig = {
  apiKey: "AIzaSyARLl7vYy6RjPMJ8NnvUJAj2T0wWWXamgc",
  authDomain: "mandocal.firebaseapp.com",
  databaseURL: "https://mandocal-default-rtdb.firebaseio.com",
  projectId: "mandocal",
  storageBucket: "mandocal.firebasestorage.app",
  messagingSenderId: "364772559458",
  appId: "1:364772559458:web:6e0d98d08bbf48f8e0df3b",
  measurementId: "G-RYF99BP1RZ"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

window.isAdmin = false;
window.admin_mode = function() {
    window.isAdmin = true;
    console.log("Admin mode toggled ON");
    renderCalendar();
};

const ALL_EPISODES = [];
const S1_EPS = []; for(let i=1; i<=8; i++) S1_EPS.push('S1E'+i);
const S2_EPS = []; for(let i=1; i<=8; i++) S2_EPS.push('S2E'+i);
const BOBF_EPS = []; for(let i=1; i<=7; i++) BOBF_EPS.push('BoBFE'+i);
const S3_EPS = []; for(let i=1; i<=8; i++) S3_EPS.push('S3E'+i);

const PAST_WATCHED = {
  '2026-03-16': ['S1E1'], '2026-03-17': ['S1E2'], '2026-03-18': ['S1E3'],
  '2026-03-19': ['S1E4'], '2026-03-21': ['S1E5']
};

let userModifiers = {}; 
let targetMovieDateStr = '2026-05-22';
const _now = new Date();
const today = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
let currentDate = new Date(today.getFullYear(), today.getMonth(), 1); 
let targetMovieDate = new Date(2026, 4, 22);

function saveToFirebase() {
    if (!window.isAdmin) return;
    db.ref('calendarData').set({
        userModifiers: userModifiers,
        targetMovieDateStr: targetMovieDateStr
    });
}

db.ref('calendarData').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        userModifiers = data.userModifiers || {};
        if (data.targetMovieDateStr) {
            targetMovieDateStr = data.targetMovieDateStr;
            let parts = targetMovieDateStr.split('-');
            targetMovieDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        }
    }
    renderCalendar();
});

function formatDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

// Generate base valid schedule dates 
function getValidDates() {
    let dates = [];
    let start = new Date(today);
    start.setDate(start.getDate() + 1); 
    // We want to be able to plan basically any day up to the movie
    let end = new Date(targetMovieDate);
    end.setDate(end.getDate() - 1); 
    
    // Anchor to Saturday, March 21, 2026
    const anchorDate = new Date(2026, 2, 21);
    
    for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        let fDate = formatDate(d);
        if (d.getDay() === 5) { dates.push(fDate); continue; }
        
        const diffTime = d.getTime() - anchorDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(diffDays / 7);
        
        if (weekNum % 2 !== 0) {
            dates.push(fDate);
        }
    }
    return dates.sort();
}

function calculateSchedule() {
    // Checkboxes might not exist yet if HTML isn't updated, handle gracefully
    let chkS1 = document.getElementById('chk-s1');
    let chkS2 = document.getElementById('chk-s2');
    let chkBobf = document.getElementById('chk-bobf');
    let chkS3 = document.getElementById('chk-s3');
    
    let showS1 = chkS1 ? chkS1.checked : true;
    let showS2 = chkS2 ? chkS2.checked : true;
    let showBobf = chkBobf ? chkBobf.checked : true;
    let showS3 = chkS3 ? chkS3.checked : true;

    let schedule = {};
    if (showS1) { schedule = JSON.parse(JSON.stringify(PAST_WATCHED)); }

    let remainingEps = [];
    if (showS1) remainingEps.push('S1E6', 'S1E7', 'S1E8');
    if (showS2) remainingEps.push(...S2_EPS);
    if (showBobf) remainingEps.push(...BOBF_EPS);
    if (showS3) remainingEps.push(...S3_EPS);

    let validSet = new Set(getValidDates());
    // Ensure all days with user modifiers are considered valid slots
    Object.keys(userModifiers).forEach(d => {
        let nd = new Date(d);
        // Any day in the future before the movie can be a slot if the user insisted
        if (nd > today && nd < targetMovieDate) {
            validSet.add(d);
        }
    });

    let allValidDates = Array.from(validSet).sort();
    let slotCapacity = {};
    let validDatesOriginal = getValidDates();
    
    allValidDates.forEach(d => {
        // Base is 1 if it's a valid planning day, 0 if it's skip day
        let base = validDatesOriginal.includes(d) ? 1 : 0;
        let mod = userModifiers[d] || 0;
        slotCapacity[d] = Math.max(0, base + mod);
    });

    let remainingSlots = Object.values(slotCapacity).reduce((a,b)=>a+b, 0);
    let neededEps = remainingEps.length;
    let extraNeeded = neededEps - remainingSlots;
    
    if(extraNeeded > 0) {
        // Distribute backwards logic
        let activeDates = allValidDates.filter(d => slotCapacity[d] > 0);
        if (activeDates.length === 0) activeDates = [...allValidDates]; // Fallback
        
        let reversedDates = [...activeDates].reverse();
        let toggle = true; // 2, 1, 2, 1...
        let added = 0;
        let pDate = 0;
        // Safety break
        let loopCount = 0; 
        while(added < extraNeeded && reversedDates.length > 0 && loopCount < 1000) {
            let d = reversedDates[pDate];
            let additional = toggle ? 1 : 0;
            if (additional > 0) {
                slotCapacity[d] = (slotCapacity[d] || 0) + additional;
                added += additional;
            }
            toggle = !toggle;
            if(pDate === reversedDates.length - 1) {
                pDate = 0;
            } else {
                pDate++;
            }
            loopCount++;
        }
    }

    allValidDates.forEach(d => {
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

function renderMiniCalendar() {
    const grid = document.getElementById('mini-cal-grid');
    if(!grid) return;
    grid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const disp = document.getElementById('mini-month-display');
    if(disp) disp.innerText = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = getDaysInMonth(year, month);
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    for(let i = 0; i < firstDay; i++) {
        let el = document.createElement('span');
        el.className = 'dim'; el.innerText = prevMonthDays - firstDay + i + 1;
        grid.appendChild(el);
    }
    
    for(let i = 1; i <= daysInMonth; i++) {
        let el = document.createElement('span');
        el.innerText = i;
        let dObj = new Date(year, month, i);
        if (formatDate(dObj) === formatDate(today)) {
            el.className = 'active-day';
        }
        grid.appendChild(el);
    }
    
    const remaining = 42 - (firstDay + daysInMonth);
    for(let i = 1; i <= remaining; i++) {
        let el = document.createElement('span');
        el.className = 'dim'; el.innerText = i;
        grid.appendChild(el);
    }
}

function renderCalendar() {
  const schedule = calculateSchedule();
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  document.getElementById('current-month-display').innerText = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  renderMiniCalendar();
  
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

// Attach to window so HTML onlick can see it
window.adjustEpisode = function(dateStr, change) {
  if (!window.isAdmin) return;
  if (new Date(dateStr) <= today) return;
  if (new Date(dateStr) >= targetMovieDate) return;
  
  userModifiers[dateStr] = (userModifiers[dateStr] || 0) + change;
  if (userModifiers[dateStr] === 0) delete userModifiers[dateStr];
  
  saveToFirebase();
  renderCalendar();
}

window.allowDrop = (e) => { 
  if(!window.isAdmin) return;
  e.preventDefault(); 
};
window.dragMovie = (e) => { 
  if(!window.isAdmin) return;
  e.dataTransfer.setData('text/plain', 'movie'); 
};
window.dropMovie = (e, dateStr) => {
    if(!window.isAdmin) return;
    e.preventDefault();
    if (e.dataTransfer.getData('text') === 'movie') {
        let droppedDate = new Date(dateStr);
        let parts = dateStr.split('-');
        let d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        
        if (d > today) {
            targetMovieDate = d;
            targetMovieDateStr = dateStr;
            saveToFirebase();
            renderCalendar();
        }
    }
};

function createDayCell(date, isCurrentMonth, schedule) {
  const cell = document.createElement('div');
  cell.className = 'day-cell' + (!isCurrentMonth ? ' not-current-month' : '');
  const dateStr = formatDate(date);
  if(dateStr === formatDate(today)) cell.classList.add('today');
  
  // Setup movability
  cell.ondragover = window.allowDrop;
  cell.ondrop = (e) => window.dropMovie(e, dateStr);
  
  const dateHeader = document.createElement('div');
  dateHeader.className = 'date-header';
  const num = document.createElement('div');
  num.className = 'date-number';
  num.innerText = date.getDate();
  dateHeader.appendChild(num);
  cell.appendChild(dateHeader);
  
  // + / - Controls
  if (window.isAdmin && date > today && date < targetMovieDate) {
    const controls = document.createElement('div');
    controls.className = 'controls';
    // Use &quot; for safety
    controls.innerHTML = `<button onclick="adjustEpisode('${dateStr}', 1)">+</button><button onclick="adjustEpisode('${dateStr}', -1)">-</button>`;
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
  
  if (dateStr === formatDate(targetMovieDate)) {
      const mv = document.createElement('div');
      mv.className = 'episode movie';
      mv.innerText = '\uD83C\uDFA5 Mando & Grogu'; // Camera emoji in unicode
      if (window.isAdmin) {
          mv.draggable = true;
          mv.ondragstart = window.dragMovie;
      }
      eps.appendChild(mv);
  }
  
  cell.appendChild(eps);
  return cell;
}

// Interaction
document.getElementById('prev-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
document.getElementById('next-month').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };
document.getElementById('today-btn').onclick = () => { currentDate = new Date(today); renderCalendar(); };

const mp = document.getElementById('mini-prev');
if(mp) mp.onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
const mn = document.getElementById('mini-next');
if(mn) mn.onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };

const mb = document.getElementById('menu-btn');
if(mb) mb.onclick = () => { 
    const sb = document.getElementById('sidebar');
    if(sb) sb.classList.toggle('collapsed'); 
};

['chk-s1', 'chk-s2', 'chk-bobf', 'chk-s3'].forEach(id => {
    let el = document.getElementById(id);
    if(el) el.addEventListener('change', renderCalendar);
});

// Scroll
let wheelTimeout;
const ca = document.querySelector('.calendar-area');
if(ca) {
    ca.addEventListener('wheel', (e) => {
        if(wheelTimeout) return;
        wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 100); 
        if(e.deltaY > 0) {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        } else if (e.deltaY < 0) {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        }
        // Prevent default only if inside calendar area if needed
    });
}

if (window.innerWidth < 768) {
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.add('collapsed');
}

renderCalendar();
