let favorites = []
let placemarks = new Map();
let map
ymaps.ready(init);
var modal = document.getElementById("list-modal");
var span = document.getElementsByClassName("close")[0];

span.addEventListener('click', closeModal);

window.addEventListener('click', function (event) {
    if (event.target === modal && window.innerWidth > 700) {
        closeModal();
    }
});

function closeModal() {
    modal.style.display = "none";
}

function checkFavorites(KS_ID) {
    return favorites !== null && favorites.some(item => item.KS_ID === KS_ID);
}

const getStops = () =>
    fetch("https://tosamara.ru/api/v2/classifiers/stopsFullDB.xml")
        .then(response => response.text())
        .then(str => new DOMParser().parseFromString(str, "application/xml"));


async function getInfoByStop(KS_ID) {
    try {
        const response = await fetch(`https://tosamara.ru/api/v2/xml?method=getFirstArrivalToStop&KS_ID=${KS_ID}&os=android&clientid=test&authkey=${SHA1(KS_ID + "just_f0r_tests")}`);
        const str = await response.text();
        return new DOMParser().parseFromString(str, "application/xml");
    } catch (error) {
        console.error("Error fetching or parsing data:", error);
        throw error;
    }
}

function addToFavorite(transferObj) {
    const imgId = 'img_plm_' + transferObj.KS_ID;
    const img = document.getElementById(imgId);

    if (checkFavorites(transferObj.KS_ID)) {
        img.src = "https://img.icons8.com/ios/25/love-circled.png";
        favorites = favorites.filter(item => item.KS_ID !== transferObj.KS_ID);
    } else {
        img.src = "https://img.icons8.com/ios-filled/25/love-circled.png";
        favorites.push(transferObj);
    }

    localStorage.setItem("favorite", JSON.stringify(favorites));
    renderFavorites();
}


function setColorByTransport(placemark, stop) {
    const transportTypes = ['trams', 'trolleybuses', 'metros', 'electricTrains', 'riverTransports'];
    const presets = {
        'trams': 'islands#redDotIcon',
        'trolleybuses': 'islands#blueDotIcon',
        'metros': 'islands#blueRapidTransitIcon',
        'electricTrains': 'islands#blueRailwayIcon',
        'riverTransports': 'islands#blueWaterwayIcon'
    };

    for (const type of transportTypes) {
        if (stop.getElementsByTagName(type)[0].textContent !== "") {
            placemark.options.set('preset', presets[type]);
            return;
        }
    }
    placemark.options.set('preset', 'islands#greenDotIcon');
}


async function renderInfoByNextStops(hullNo) {
    try {
        const response = await fetch(`https://tosamara.ru/api/v2/json?method=getTransportPosition&HULLNO=${hullNo}&os=android&clientid=test&authkey=${SHA1(hullNo + "just_f0r_tests")}`);
        const res = await response.json();

        const listElem = document.querySelector('#favorite-list');
        listElem.innerHTML = "<h2>Следующие остановки: </h2>";

        if (!res || !res.nextStops || res.nextStops.length === 0) {
            const newItem = document.createElement('div');
            newItem.innerHTML = "<h3>Пусто</h3>";
            listElem.appendChild(newItem);
            return;
        }

        for (const stop of res.nextStops) {
            const newItem = document.createElement('div');
            const { KS_ID, time } = stop;
            const balloonContentBody = placemarks.get(KS_ID)?.properties.get('balloonContentBody') || '';

            newItem.innerHTML = `
                <div class="favorite-list-item" data-ks-id="${KS_ID}">
                    <h5>${balloonContentBody}</h5>
                    <h6>${'Будет через ' + Math.round(+time / 60)}</h6>
                </div>
            `;

            listElem.appendChild(newItem);
        }

        listElem.addEventListener('click', (event) => {
            const ksId = event.target.closest('.favorite-list-item')?.dataset.ksId;
            if (ksId) {
                modal.style.display = "none";
                placemarks.get(ksId)?.balloon.open();
            }
        });

        modal.style.display = "block";
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

function renderFavorites() {
    const listElem = document.querySelector('#favorite-list');
    listElem.innerHTML = "<h2>Избранные остановки: </h2>";

    if (!favorites.length) {
        listElem.innerHTML += "<div><h3>Пусто</h3></div>";
        closeModal();
        return;
    }

    favorites.forEach(stop => {
        const newItem = createFavorite(stop);
        newItem.addEventListener('click', () => openStopInfo(stop));
        listElem.appendChild(newItem);
    });

    function createFavorite(stop) {
        const newItem = document.createElement('div');
        newItem.innerHTML = `<div class="favorite-list-item" data-ks-id="${stop.KS_ID}"><h5>${stop.title_station}</h5></div>`;
        return newItem;
    }

    function openStopInfo(stop) {
        const ksId = stop.KS_ID;
        map.setCenter([stop.x, stop.y]);
        closeModal();
        placemarks.get(ksId)?.balloon.open();
    }

    modal.style.display = "none";
}

async function init() {
    if (localStorage.getItem('favorite') != null) {
        favorites = JSON.parse(localStorage.getItem('favorite'))
    }
    renderFavorites()
    map = new ymaps.Map("YMapsID", {
        center: [53.19, 50.13],
        zoom: 10,
        controls: ['smallMapDefaultSet']
    });

    let favorites_button = new ymaps.control.Button({
        data: { content: "Избранные остановки" },
        options: { size: 'large', maxWidth: [28, 150, 178], selectOnClick: false },
    });

    favorites_button.events.add('click', (e) => {
        renderFavorites();
        modal.style.display = "block";
    });

    map.controls.add(favorites_button, { float: 'left' });

    await getStops().then(async stops => {
        let collectionStops = stops.getElementsByTagName("stop")
        for (let i = 0; i < collectionStops.length; i++) {
            const stop = collectionStops[i];
            const KS_ID = stop.getElementsByTagName("KS_ID")[0].textContent;
            const title_station = stop.getElementsByTagName("title")[0].textContent;
            const latitude = stop.getElementsByTagName("latitude")[0].textContent;
            const longitude = stop.getElementsByTagName("longitude")[0].textContent;

            const transferObj = {
                KS_ID,
                title_station,
                x: latitude,
                y: longitude
            }

            let placemark = new ymaps.Placemark(
                [latitude, longitude],
                {
                    balloonContentHeader: `<img id='img_plm_${KS_ID}' src='https://img.icons8.com/ios/25/love-circled.png' onclick='addToFavorite(${JSON.stringify(transferObj)})' alt="photo" style='margin-right: 7px;'/>${title_station}`,
                    balloonContentBody: `Остановка ${collectionStops[i].getElementsByTagName("adjacentStreet")[0].textContent} ${collectionStops[i].getElementsByTagName("direction")[0].textContent}`,
                    hintContent: collectionStops[i].getElementsByTagName("title")[0].textContent
                }
            );

            setColorByTransport(placemark, collectionStops[i])

            placemark.events.add('balloonopen', async function (e) {
                placemark.properties.set('balloonContentFooter', "Идет загрузка данных...");

                try {
                    const stop = await getInfoByStop(KS_ID);
                    const newContent = Array.from(stop.getElementsByTagName("transport")).map(transport => `
                        <div onclick='renderInfoByNextStops(${transport.getElementsByTagName("hullNo")[0].textContent})'>
                            ${transport.getElementsByTagName("type")[0].textContent} ${transport.getElementsByTagName("number")[0].textContent}
                            будет через ${transport.getElementsByTagName("time")[0].textContent}<br/>
                        </div>`).join("");

                    placemark.properties.set('balloonContentFooter', newContent);
                } catch (error) {
                    console.error("Error loading stop information:", error);
                }

                if (checkFavorites(KS_ID)) {
                    placemark.properties.set('balloonContentHeader', `<img id='img_plm_${KS_ID}' src='https://img.icons8.com/ios-filled/25/love-circled.png' onclick='addToFavorite(${JSON.stringify(transferObj)})' alt="photo"/>${title_station}`);
                }

            });

            placemarks.set(KS_ID, placemark)
            map.geoObjects.add(placemark);
        }
    })
}

function SHA1(msg) {
    function rotate_left(n, s) { var t4 = (n << s) | (n >>> (32 - s)); return t4; }; function lsb_hex(val) {
        var str = ''; var i; var vh; var vl; for (i = 0; i <= 6; i += 2) { vh = (val >>> (i * 4 + 4)) & 0x0f; vl = (val >>> (i * 4)) & 0x0f; str += vh.toString(16) + vl.toString(16); }
        return str;
    }; function cvt_hex(val) {
        var str = ''; var i; var v; for (i = 7; i >= 0; i--) { v = (val >>> (i * 4)) & 0x0f; str += v.toString(16); }
        return str;
    }; function Utf8Encode(string) {
        string = string.replace(/\r\n/g, '\n'); var utftext = ''; for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n); if (c < 128) { utftext += String.fromCharCode(c); }
            else if ((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); }
            else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); }
        }
        return utftext;
    }; var blockstart; var i, j; var W = new Array(80); var H0 = 0x67452301; var H1 = 0xEFCDAB89; var H2 = 0x98BADCFE; var H3 = 0x10325476; var H4 = 0xC3D2E1F0; var A, B, C, D, E; var temp; msg = Utf8Encode(msg); var msg_len = msg.length; var word_array = new Array(); for (i = 0; i < msg_len - 3; i += 4) { j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3); word_array.push(j); }
    switch (msg_len % 4) { case 0: i = 0x080000000; break; case 1: i = msg.charCodeAt(msg_len - 1) << 24 | 0x0800000; break; case 2: i = msg.charCodeAt(msg_len - 2) << 24 | msg.charCodeAt(msg_len - 1) << 16 | 0x08000; break; case 3: i = msg.charCodeAt(msg_len - 3) << 24 | msg.charCodeAt(msg_len - 2) << 16 | msg.charCodeAt(msg_len - 1) << 8 | 0x80; break; }
    word_array.push(i); while ((word_array.length % 16) != 14) word_array.push(0); word_array.push(msg_len >>> 29); word_array.push((msg_len << 3) & 0x0ffffffff); for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
        for (i = 0; i < 16; i++)W[i] = word_array[blockstart + i]; for (i = 16; i <= 79; i++)W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1); A = H0; B = H1; C = H2; D = H3; E = H4; for (i = 0; i <= 19; i++) { temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        for (i = 20; i <= 39; i++) { temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        for (i = 40; i <= 59; i++) { temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        for (i = 60; i <= 79; i++) { temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        H0 = (H0 + A) & 0x0ffffffff; H1 = (H1 + B) & 0x0ffffffff; H2 = (H2 + C) & 0x0ffffffff; H3 = (H3 + D) & 0x0ffffffff; H4 = (H4 + E) & 0x0ffffffff;
    }
    var temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4); return temp.toLowerCase();
}