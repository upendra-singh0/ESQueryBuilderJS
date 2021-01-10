const boost = 10; // individual fields can be boosted at query time using this parameter
const prefixLength = 1; //fuzzy query parameter, number of beginning characters left unchanged when creating expansions. Default 0.
const minScore = 0.1; //to exclude documents that do not meet a certain score threshold the min_score parameter can be set to the desired score threshold.

const ESSimpleQueryBuilder = ({
  rawOptions, //for options like collapse, _source
  filters,
  matches,
  sorts,
  pagination,
  nestedFilters,
  nestedMatches,
}) => {
  const query = {
    query: {
      bool: {
        must: [],
      },
    },
  };

  if (pagination) {
    query.from = pagination.from;
    query.size = pagination.size;
  }

  if (rawOptions) {
    Object.keys(rawOptions).forEach((key) => {
      query[key] = rawOptions[key];
    });
  }

  if (sorts) {
    query.sort = [];
    sorts.forEach((item) => {
      if (item.nested) {
        const nestedObject = {
          [item.field]: {
            mode: item.mode,
            order: item.order,
            nested: {
              path: item.path, //parent of nested field used for sorting
            },
          },
        };
        query.sort.push(nestedObject);
      } else {
        const object = {
          [item.field]: {
            order: item.order,
          },
        };
        query.sort.push(object);
      }
    });
  }

  if (filters) {
    filters.forEach((item) => {
      if (Array.isArray(item[Object.keys(item)[0]])) {
        const obj = {
          terms: {
            [Object.keys(item)[0]]: item[Object.keys(item)[0]],
          },
        };
        query.query.bool.must.push(obj);
      } else {
        const obj = {
          term: {
            [Object.keys(item)[0]]: item[Object.keys(item)[0]],
          },
        };
        query.query.bool.must.push(obj);
      }
    });
  }

  if (matches) {
    matches.forEach((item) => {
      const obj = {
        match: {
          [Object.keys(item)[0]]: item[Object.keys(item)[0]],
        },
      };
      query.query.bool.must.push(obj);
    });
  }

  if (nestedFilters) {
    nestedFilters.forEach((item) => {
      if (Array.isArray(item.value)) {
        const obj = {
          nested: {
            path: item.path,
            query: {
              terms: { [item.key]: item.value },
            },
          },
        };
        query.query.bool.must.push(obj);
      } else {
        const obj = {
          nested: {
            path: item.path,
            query: {
              term: { [item.key]: item.value },
            },
          },
        };
        query.query.bool.must.push(obj);
      }
    });
  }

  if (nestedMatches) {
    nestedMatches.forEach((item) => {
      const obj = {
        nested: {
          path: item.path,
          query: {
            match: { [item.key]: item.value },
          },
        },
      };
      query.query.bool.must.push(obj);
    });
  }
  return query;
};

const ESSearchQueryBuilder = ({
  q, //search string
  fields, //fields you wanted to search in, contain (phraseFields => for phrase search fields, fuzzyfields => >==for fuzzy search)
  rawOptions,
  filters,
  matches,
  sorts,
  pagination,
}) => {
  const query = {
    query: {
      function_score: {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: q,
                  type: 'phrase',
                  fields: fields.phraseFields, // ['productName^5', 'brandName^3', 'productDescription^1'],
                  boost: boost,
                },
              },
              {
                multi_match: {
                  query: q,
                  type: 'most_fields',
                  fields: fields.fuzzyFields, //['productName^5', 'brandName^3']
                  fuzziness: 'AUTO',
                  prefix_length: prefixLength,
                },
              },
            ],
            must: [],
          },
        },
        min_score: minScore,
      },
    },
  };

  if (pagination) {
    query.from = pagination.from;
    query.size = pagination.size;
  }

  if (rawOptions) {
    Object.keys(rawOptions).forEach((key) => {
      query[key] = rawOptions[key];
    });
  }

  if (sorts) {
    query.sort = [];
    sorts.forEach((item) => {
      if (item.nested) {
        const nestedObject = {
          [item.field]: {
            mode: item.mode,
            order: item.order,
            nested: {
              path: item.path,
            },
          },
        };
        query.sort.push(nestedObject);
      } else {
        const object = {
          [item.field]: {
            order: item.order,
          },
        };
        query.sort.push(object);
      }
    });
  }

  if (filters) {
    filters.forEach((item) => {
      const obj = {
        term: {
          [Object.keys(item)[0]]: item[Object.keys(item)[0]],
        },
      };
      console.log(obj);
      query.query.function_score.query.bool.must.push(obj);
    });
  }

  if (matches) {
    matches.forEach((item) => {
      const obj = {
        match: {
          [Object.keys(item)[0]]: item[Object.keys(item)[0]],
        },
      };
      console.log(obj);
      query.query.function_score.query.bool.must.push(obj);
    });
  }
  return query;
};

// const aggs = {
//     field: 'brand.code',
//     size: itemPerPage,
//     order: 'asc'
//   };

//   const topHit = {
//     field: 'title.keyword',
//     size: numOfProducts,
//     order: 'asc'
//   };

//If you want to group search hits, use the collapse parameter instead.
//https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-top-hits-aggregation.html
const ESTopHitsAggsBuilder = ({ aggs, topHit, filters, matches }) => {
  const query = {
    size: 0,
    query: {
      bool: {
        must: [],
      },
    },
    aggs: {
      top_tags: {
        terms: {
          field: aggs.field, //field you want to aggregate on
          size: aggs.size,
          order: {
            _key: aggs.order,
          },
        },
        aggs: {
          top_hit_items: {
            // aggs name
            top_hits: {
              sort: [
                //How the top matching hits should be sorted. By default the hits are sorted by the score of the main query.
                {
                  [topHit.field]: {
                    order: topHit.order,
                  },
                },
              ],
              size: topHit.size, //The maximum number of top matching hits to return per bucket. default ->top three matching hits.
              from: 0,
            },
          },
        },
      },
    },
  };

  if (filters) {
    filters.forEach((item) => {
      if (Array.isArray(item[Object.keys(item)[0]])) {
        const obj = {
          terms: {
            [Object.keys(item)[0]]: item[Object.keys(item)[0]],
          },
        };
        query.query.bool.must.push(obj);
      } else {
        const obj = {
          term: {
            [Object.keys(item)[0]]: item[Object.keys(item)[0]],
          },
        };
        query.query.bool.must.push(obj);
      }
    });
  }

  if (matches) {
    matches.forEach((item) => {
      const obj = {
        match: {
          [Object.keys(item)[0]]: item[Object.keys(item)[0]],
        },
      };
      query.query.bool.must.push(obj);
    });
  }

  return query;
};
module.exports = {
  ESSimpleQueryBuilder,
  ESSearchQueryBuilder,
  ESTopHitsAggsBuilder,
};
