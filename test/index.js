'use strict';

var assert = require('assert');
var bmSitemap = require('../lib');

describe('bm-sitemap', function () {
	var sitemap = bmSitemap();
	it('should return ahmad', function () {
		assert(sitemap, 'ahmad');
	});
});
