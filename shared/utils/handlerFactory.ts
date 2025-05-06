import Objection, { Model, QueryBuilder } from 'objection';
import catchAsync from './catchAsync';
import AppError from './appError';
import { success } from '../helpers/request';
import APIFeatures from './apiFeature';

type PopOptions = string[];
interface AllOptions<M extends Model> {
  $before?: (query: QueryBuilder<M>, reqBody: any) => QueryBuilder<M>; // Function to apply pre-query modifications
}

// De
type IModel = typeof Model;
export const deleteOne = (Model: IModel) =>
  catchAsync(async (req: any, res: any, next: any) => {
    const numRowsDeleted: number = await Model.query().deleteById(req.params.id);

    if (numRowsDeleted === 0) {
      return next(new AppError('No document found with that ID', 404));
    }
    success(res, 'Data created succesfully', null, 204);
  });

export const updateOne = (Model: IModel) =>
  catchAsync(async (req: any, res: any, next: any) => {
    const doc: any = await Model.query().patchAndFetchById(req.params.id, req.body);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    success(res, 'Data created succesfully', doc, 200);
  });

export const createOne = (Model: IModel) =>
  catchAsync(async (req: any, res: any, next: any) => {
    if (req.params.tourId) {
      req.body.tour = Number(req.params.tourId);

      const doc: any = await Model.query().insert(req.body);
      success(res, 'Data created succesfully', doc, 201);
    } else {
      const doc: any = await Model.query().insert(req.body);

      success(res, 'Data created succesfully', doc, 201);
    }
  });

export const getOne = (Model: IModel, popOptions?: PopOptions) =>
  catchAsync(async (req: any, res: any, next: any) => {
    let query: QueryBuilder<Model, Model | undefined> = Model.query().findById(req.params.id);

    // To allow for nested GET reviews on tour (hack)
    if (req.params.tourId) {
      query = query.where('tour_id', req.params.tourId);
    }

    if (popOptions) {
      // reconstruct options
      let options = {};
      popOptions.forEach((d, i) => {
        options = {
          ...options,
          [d]: true,
        };
      });

      query = query.withGraphFetched(options);
    }

    const doc: any = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    success(res, 'Data fetched succesfully', doc);
  });
export const getAll = <M extends Model>(Model: IModel, options?: AllOptions<M>) =>
  catchAsync(async (req: any, res: any, next: any) => {
    let query: any = Model.query();

    if (options?.$before) {
      query = options.$before(query, req);
    }
    // To allow for nested GET reviews on tour (hack)
    if (req.params.tourId) {
      query = query.where('tour', req.params.tourId);
    }

    // Filter based on req.query
    for (const key in req.query) {
      if (req.query.hasOwnProperty(key)) {
        // Check if the key is valid for filtering
        if (isValidFilterKey(key)) {
          // Assuming you implement isValidFilterKey function
          const value = req.query[key];

          // Check if the key corresponds to a function in the query object
          if (typeof query[key as keyof Model] === 'function') {
            // Use type assertion to let TypeScript know that the key is valid
            query = query[key](value);
          }
        } else {
          console.log(req.query[key], '000');
          delete req.query[key];
        }
      }
    }

    // Function to validate if the key is valid for filtering
    function isValidFilterKey(key: string): key is any {
      // Define an array of allowed filter keys
      const allowedKeys: any = ['page', 'sort', 'limit', 'fields']; // Add your allowed keys here

      // Check if the key is included in the allowedKeys array
      return allowedKeys.includes(key as keyof Model);
    }

    // EXECUTE QUERY
    const features = new APIFeatures(query, req.query).filter().selectFields().sort().paginate();

    const doc: any[] = await features.query;

    // SEND RESPONSE
    success(res, 'Data fetched successfully', {
      count: doc.length,
      result: doc,
    });
  });

export const factory = {
  getAll,
  getOne,
  updateOne,
  createOne,
  deleteOne,
};
