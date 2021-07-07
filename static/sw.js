var CACHE_NAME = 'mileage_cache-v1.6';
var urlsToCache = 
[
  '/mileage', 
  '/service', 
  '/css/mileage.css',
  'scripts/jquery_3_3_1.min.js',
  'scripts/bootstrap.min.js',
  'css/bootstrap.min.css'
];
// [
//   '/scripts/bootstrap_4_2_1.min.js',
//   '/css/bootstrap_4_2_1.min.css',
//   '/scripts/jquery_3_3_1.min.js',
//   '/scripts/popper_1_14_6.min.js',
//   '/css/fontawesome_all_5_5_0.css',
// ];

self.addEventListener('install', function(event) {
 // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});


self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          //cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );	
});