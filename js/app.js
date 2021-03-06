(function() {

  // MapMarkerSet class contains information of map markers for searching.
  var MapMarkerSet = function(marker, name, category, position) {
    this.marker = marker,
    this.name = name,
    this.category = category,
    this.position = position
  };

  // Main app module and controller.
  angular.module('map', [])
  .controller('MapController', ['$http', '$scope', function($http, $scope) {
    var self = $scope;
    var map;
    var service;
    var preferredLocation;
    var infowindow;
    var mapBounds;
    var neighborhoodMarkers = [];
    var venueMarkers = [];
    var defaultNeighborhood = "Mountain View";

    self.topPicksList = [];
    self.filteredList = [];
    self.neighborhood = defaultNeighborhood;
    self.keyword = '';
    self.listBoolean = true;
    self.settingsBoolean = true;

    // list toggle method. open/close the list view
    self.listToggle = function() {
      if (self.listBoolean === true) {
        self.listBoolean = false;
      } else {
        self.listBoolean = true;
      }
    };

    // setting toggle method. open/close setting menu
    self.settingsToggle = function() {
      if (self.settingsBoolean === true) {
        self.settingsBoolean = false;
      } else {
        self.settingsBoolean = true;
      }
    };

    // resize map element and request default neighborhood on load
    window.addEventListener('load', function(e) {
      document.getElementById('map').style.height = window.innerHeight + 'px';
      google.maps.event.trigger(map, "resize");
      self.updateNeighborhood();
    });

    // initialize the map
    initializeMap();

    // update the list view and map markers based on search keyword
    self.$watch('keyword', function() {
      displayList();
      filteringMarkersBy(self.keyword.toLowerCase());
    });

    // method for updating the neighborhood
    self.updateNeighborhood = function() {
      if (self.neighborhood != '') {
        if (venueMarkers.length > 0) {
          removeVenueMarkers();
        }
        removeNeighborhoodMarker();
        requestNeighborhood(self.neighborhood);
        self.keyword = '';
      }
    }

    // trigger click event to markers when list item is clicked
    self.clickMarker = function(venue) {
      var venueName = venue.venue.name.toLowerCase();
      for (var i in venueMarkers) {
        if (venueMarkers[i].name === venueName) {
          google.maps.event.trigger(venueMarkers[i].marker, 'click');
          map.panTo(venueMarkers[i].position);
        }
      }
    };

    // method for updating list view based on search keyword
    function displayList() {
      var venue;
      var list = [];
      var keyword = self.keyword.toLowerCase();
      for (var i in self.topPicksList) {
        venue = self.topPicksList[i].venue;
        if (venue.name.toLowerCase().indexOf(keyword) != -1 ||
          venue.categories[0].name.toLowerCase().indexOf(keyword) != -1) {
          list.push(self.topPicksList[i]);
        }
      }
      self.filteredList = list;
    }

    // filtering method for map markers
    function filteringMarkersBy(keyword) {
      for (var i in venueMarkers) {
        if (venueMarkers[i].marker.map === null) {
          venueMarkers[i].marker.setMap(map);
        }
        if (venueMarkers[i].name.indexOf(keyword) === -1 &&
          venueMarkers[i].category.indexOf(keyword) === -1) {
          venueMarkers[i].marker.setMap(null);
        }
      }
    }

    // method for initializing the map
    function initializeMap() {
      var mapOptions = {
        zoom: 14,
        disableDefaultUI: true
      };
      map = new google.maps.Map(document.querySelector('#map'), mapOptions);
      infowindow = new google.maps.InfoWindow();
    }

    // set neighborhood marker on the map and get popular places from API
    function getNeighborhoodInformation(placeData) {
      var lat = placeData.geometry.location.lat();
      var lng = placeData.geometry.location.lng();
      var name = placeData.name;
      preferredLocation = new google.maps.LatLng(lat, lng);
      map.setCenter(preferredLocation);

      // neighborhood marker
      var marker = new google.maps.Marker({
        map: map,
        position: placeData.geometry.location,
        title: name,
        icon: "images/ic_grade_black_18dp.png"
      });
      neighborhoodMarkers.push(marker);

      google.maps.event.addListener(marker, 'click', function() {
        infowindow.setContent(name);
        infowindow.open(map, marker);
      });

      // request popular places based on preferred location
      foursquareBaseUri = "https://api.foursquare.com/v2/venues/explore?ll=";
      baseLocation = lat + ", " + lng;
      extraParams = "&limit=20&section=topPicks&day=any&time=any&locale=en&oauth_token=5WJZ5GSQURT4YEG251H42KKKOWUNQXS5EORP2HGGVO4B14AB&v=20141121";
      foursquareQueryUri = foursquareBaseUri + baseLocation + extraParams;
      $http.get(foursquareQueryUri).success(function(data) {
        self.topPicksList = data.response.groups[0].items;
        // display list when data has been fetched successfully
        displayList();
        // create markers for each venue
        for (var i in self.topPicksList) {
          createMarkers(self.topPicksList[i].venue);
        }

        // change the map zoom level by suggested bounds
        var bounds = data.response.suggestedBounds;
        if (bounds != undefined) {
          mapBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(bounds.sw.lat, bounds.sw.lng),
            new google.maps.LatLng(bounds.ne.lat, bounds.ne.lng));
          map.fitBounds(mapBounds);
        }
      });
    }

    // callback method for neighborhood location
    function neighborhoodCallback(results, status) {
      if (status == google.maps.places.PlacesServiceStatus.OK) {
        getNeighborhoodInformation(results[0])
      }
    }

    // request neighborhood location data from PlaceService
    function requestNeighborhood(neighborhood) {
      var request = {
        query: neighborhood
      };
      service = new google.maps.places.PlacesService(map);
      service.textSearch(request, neighborhoodCallback);
    }

    // remove neighborhood marker from the map
    // this method is called when neighborhood is newly defined
    function removeNeighborhoodMarker() {
      for (var i in neighborhoodMarkers) {
        neighborhoodMarkers[i].setMap(null);
        neighborhoodMarkers[i] = null;
      }
      while (neighborhoodMarkers.length > 0) {
        neighborhoodMarkers.pop();
      }
    }

    // create map markers of popular places
    function createMarkers(venue) {
      var lat = venue.location.lat;
      var lng = venue.location.lng;
      var name = venue.name;
      var category = venue.categories[0].name;
      var position = new google.maps.LatLng(lat, lng);
      var address = venue.location.formattedAddress;
      var contact = venue.contact.formattedPhone;
      var foursquareUrl = "https://foursquare.com/v/" + venue.id;
      var rating = venue.rating;
      var url = venue.url;
      var slicedUrl;
      if (url && url.slice(0, 7) === 'http://') {
        slicedUrl = url.slice(7);
      } else if (url && url.slice(0, 8) === 'https://') {
        slicedUrl = url.slice(8);
      } else {
        slicedUrl = url;
      }
      var ratingImg;
      var halfRating = rating / 2;
      if (halfRating >= 4.9) {
        ratingImg = 'images/star-5.0.png';
      } else if (halfRating < 4.9 && halfRating >= 4.25) {
        ratingImg = 'images/star-4.5.png';
      } else if (halfRating < 4.25 && halfRating >= 3.75) {
        ratingImg = 'images/star-4.0.png';
      } else if (halfRating < 3.75 && halfRating >= 3.25) {
        ratingImg = 'images/star-3.5.png';
      } else if (halfRating < 3.25 && halfRating >= 2.75) {
        ratingImg = 'images/star-3.0.png';
      } else {
        ratingImg = 'images/star-2.5.png';
      }

      // marker of a popular place
      var marker = new google.maps.Marker({
        map: map,
        position: position,
        title: name
      });
      venueMarkers.push(new MapMarkerSet(marker, name.toLowerCase(), category.toLowerCase(), position));

      // DOM element for infowindow content
      var startingToken = '<div class="infowindow"><p><span class="v-name">' + name +
        '</span></p><p class="v-category"><span>' + category +
        '</span></p><p class="v-address"><span>' + address;
        
      var endingToken;
      if (contact != undefined && url != undefined) {
        endingToken = '</span></p><p><span class="v-contact">' + contact + 
          '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
      } else if (contact != undefined && url === undefined) {
        endingToken = '</span></p><p><span class="v-contact">' + contact + '</span></p>';
      } else if (contact === undefined && url != undefined) {
        endingToken = '</span></p><p><a href="' + url + '" class="v-link" target="_blank">' + slicedUrl + '</a></p>';
      } else {
        endingToken = '</span></p>';
      }

      var fsToken;
      if (rating != undefined) {
        fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' +
          '<span class="v-rating">' + rating.toFixed(1) + '</span><img src="' + ratingImg + '" class="rating-stars"></p></div>';
      } else {
        fsToken = '<p><a href="' + foursquareUrl + '" target="_blank"><img class="fs-icon" src="images/Foursquare-icon.png"></a>' + 
          '<span class="v-rating"><em>no rating available</em></span></p></div>';
      }

      google.maps.event.addListener(marker, 'click', function() {
        infowindow.setContent(startingToken + endingToken + fsToken);
        infowindow.open(map, this);
        map.panTo(position);
      });
    }

    // remove markers of popular places from the map
    // this method is called when neighborhood is newly defined
    function removeVenueMarkers() {
      for (var i in venueMarkers) {
        venueMarkers[i].marker.setMap(null);
        venueMarkers[i].marker = null;
      }
      while (venueMarkers.length > 0) {
        venueMarkers.pop();
      }
    }

    // make sure the map bounds get updated on page resize
    window.addEventListener('resize', function(e) {
      map.fitBounds(mapBounds);
      document.getElementById('map').style.height = window.innerHeight + 'px';
    });
  }]);
})();