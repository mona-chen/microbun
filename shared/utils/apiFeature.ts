import { Model } from 'objection';

type QueryBuilder<T extends Model> = import('objection').QueryBuilder<T>;

interface QueryString {
  [key: string]: any;
}

class APIFeatures<T extends Model> {
  query: QueryBuilder<T>;
  queryString: QueryString;

  constructor(query: QueryBuilder<T>, queryString: QueryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj: QueryString = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    console.log(this.queryString);
    excludedFields.forEach(el => delete queryObj[el]);

    // Construct SQL conditions dynamically
    for (const key in queryObj) {
      if (Object.prototype.hasOwnProperty.call(queryObj, key)) {
        const value = queryObj[key];
        let operator = '=';

        // Handle special operators (gte, gt, lte, lt)
        if (typeof value === 'object') {
          const keys = Object.keys(value);
          if (keys.length === 1) {
            operator = keys[0].replace('$', '');
          }
        }

        // Construct the SQL condition based on the operator
        switch (operator) {
          case 'gte':
            this.query = this.query.where(key, '>=', value[operator]);
            break;
          case 'gt':
            this.query = this.query.where(key, '>', value[operator]);
            break;
          case 'lte':
            this.query = this.query.where(key, '<=', value[operator]);
            break;
          case 'lt':
            this.query = this.query.where(key, '<', value[operator]);
            break;
          default:
            this.query = this.query.where(key, value);
        }
      }
    }

    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',');

      // Construct SQL conditions dynamically
      for (const key in sortBy) {
        if (sortBy[key].startsWith('-')) {
          const val = sortBy[key].slice(1);
          this.query = this.query.orderBy(val, 'desc');
        } else {
          this.query = this.query.orderBy(`${sortBy[key]}`);
        }
      }
    } else {
      this.query = this.query.orderBy('created_at', 'desc');
    }

    return this;
  }

  selectFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',');
      this.query = this.query.select(...fields);
    } else {
      this.query = this.query.select('*');
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const offset = (page - 1) * limit;

    this.query = this.query.limit(limit).offset(offset);

    return this;
  }
}

export default APIFeatures;
