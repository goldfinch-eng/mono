## `FixedPoint`






### `fromUnscaledUint(uint256 a) → struct FixedPoint.Unsigned` (internal)

Constructs an `Unsigned` from an unscaled uint, e.g., `b=5` gets stored internally as `5**18`.




### `isEqual(struct FixedPoint.Unsigned a, uint256 b) → bool` (internal)

Whether `a` is equal to `b`.




### `isEqual(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is equal to `b`.




### `isGreaterThan(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is greater than `b`.




### `isGreaterThan(struct FixedPoint.Unsigned a, uint256 b) → bool` (internal)

Whether `a` is greater than `b`.




### `isGreaterThan(uint256 a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is greater than `b`.




### `isGreaterThanOrEqual(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is greater than or equal to `b`.




### `isGreaterThanOrEqual(struct FixedPoint.Unsigned a, uint256 b) → bool` (internal)

Whether `a` is greater than or equal to `b`.




### `isGreaterThanOrEqual(uint256 a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is greater than or equal to `b`.




### `isLessThan(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is less than `b`.




### `isLessThan(struct FixedPoint.Unsigned a, uint256 b) → bool` (internal)

Whether `a` is less than `b`.




### `isLessThan(uint256 a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is less than `b`.




### `isLessThanOrEqual(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is less than or equal to `b`.




### `isLessThanOrEqual(struct FixedPoint.Unsigned a, uint256 b) → bool` (internal)

Whether `a` is less than or equal to `b`.




### `isLessThanOrEqual(uint256 a, struct FixedPoint.Unsigned b) → bool` (internal)

Whether `a` is less than or equal to `b`.




### `min(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

The minimum of `a` and `b`.




### `max(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

The maximum of `a` and `b`.




### `add(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Adds two `Unsigned`s, reverting on overflow.




### `add(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned` (internal)

Adds an `Unsigned` to an unscaled uint, reverting on overflow.




### `sub(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Subtracts two `Unsigned`s, reverting on overflow.




### `sub(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned` (internal)

Subtracts an unscaled uint256 from an `Unsigned`, reverting on overflow.




### `sub(uint256 a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Subtracts an `Unsigned` from an unscaled uint256, reverting on overflow.




### `mul(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Multiplies two `Unsigned`s, reverting on overflow.


This will "floor" the product.


### `mul(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned` (internal)

Multiplies an `Unsigned` and an unscaled uint256, reverting on overflow.


This will "floor" the product.


### `mulCeil(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Multiplies two `Unsigned`s and "ceil's" the product, reverting on overflow.




### `mulCeil(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned` (internal)

Multiplies an `Unsigned` and an unscaled uint256 and "ceil's" the product, reverting on overflow.




### `div(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Divides one `Unsigned` by an `Unsigned`, reverting on overflow or division by 0.


This will "floor" the quotient.


### `div(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned` (internal)

Divides one `Unsigned` by an unscaled uint256, reverting on overflow or division by 0.


This will "floor" the quotient.


### `div(uint256 a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Divides one unscaled uint256 by an `Unsigned`, reverting on overflow or division by 0.


This will "floor" the quotient.


### `divCeil(struct FixedPoint.Unsigned a, struct FixedPoint.Unsigned b) → struct FixedPoint.Unsigned` (internal)

Divides one `Unsigned` by an `Unsigned` and "ceil's" the quotient, reverting on overflow or division by 0.




### `divCeil(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned` (internal)

Divides one `Unsigned` by an unscaled uint256 and "ceil's" the quotient, reverting on overflow or division by 0.




### `pow(struct FixedPoint.Unsigned a, uint256 b) → struct FixedPoint.Unsigned output` (internal)

Raises an `Unsigned` to the power of an unscaled uint256, reverting on overflow. E.g., `b=2` squares `a`.


This will "floor" the result.


### `fromSigned(struct FixedPoint.Signed a) → struct FixedPoint.Unsigned` (internal)





### `fromUnsigned(struct FixedPoint.Unsigned a) → struct FixedPoint.Signed` (internal)





### `fromUnscaledInt(int256 a) → struct FixedPoint.Signed` (internal)

Constructs a `Signed` from an unscaled int, e.g., `b=5` gets stored internally as `5**18`.




### `isEqual(struct FixedPoint.Signed a, int256 b) → bool` (internal)

Whether `a` is equal to `b`.




### `isEqual(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is equal to `b`.




### `isGreaterThan(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is greater than `b`.




### `isGreaterThan(struct FixedPoint.Signed a, int256 b) → bool` (internal)

Whether `a` is greater than `b`.




### `isGreaterThan(int256 a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is greater than `b`.




### `isGreaterThanOrEqual(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is greater than or equal to `b`.




### `isGreaterThanOrEqual(struct FixedPoint.Signed a, int256 b) → bool` (internal)

Whether `a` is greater than or equal to `b`.




### `isGreaterThanOrEqual(int256 a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is greater than or equal to `b`.




### `isLessThan(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is less than `b`.




### `isLessThan(struct FixedPoint.Signed a, int256 b) → bool` (internal)

Whether `a` is less than `b`.




### `isLessThan(int256 a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is less than `b`.




### `isLessThanOrEqual(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is less than or equal to `b`.




### `isLessThanOrEqual(struct FixedPoint.Signed a, int256 b) → bool` (internal)

Whether `a` is less than or equal to `b`.




### `isLessThanOrEqual(int256 a, struct FixedPoint.Signed b) → bool` (internal)

Whether `a` is less than or equal to `b`.




### `min(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

The minimum of `a` and `b`.




### `max(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

The maximum of `a` and `b`.




### `add(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Adds two `Signed`s, reverting on overflow.




### `add(struct FixedPoint.Signed a, int256 b) → struct FixedPoint.Signed` (internal)

Adds an `Signed` to an unscaled int, reverting on overflow.




### `sub(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Subtracts two `Signed`s, reverting on overflow.




### `sub(struct FixedPoint.Signed a, int256 b) → struct FixedPoint.Signed` (internal)

Subtracts an unscaled int256 from an `Signed`, reverting on overflow.




### `sub(int256 a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Subtracts an `Signed` from an unscaled int256, reverting on overflow.




### `mul(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Multiplies two `Signed`s, reverting on overflow.


This will "floor" the product.


### `mul(struct FixedPoint.Signed a, int256 b) → struct FixedPoint.Signed` (internal)

Multiplies an `Signed` and an unscaled int256, reverting on overflow.


This will "floor" the product.


### `mulAwayFromZero(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Multiplies two `Signed`s and "ceil's" the product, reverting on overflow.




### `mulAwayFromZero(struct FixedPoint.Signed a, int256 b) → struct FixedPoint.Signed` (internal)

Multiplies an `Signed` and an unscaled int256 and "ceil's" the product, reverting on overflow.




### `div(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Divides one `Signed` by an `Signed`, reverting on overflow or division by 0.


This will "floor" the quotient.


### `div(struct FixedPoint.Signed a, int256 b) → struct FixedPoint.Signed` (internal)

Divides one `Signed` by an unscaled int256, reverting on overflow or division by 0.


This will "floor" the quotient.


### `div(int256 a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Divides one unscaled int256 by an `Signed`, reverting on overflow or division by 0.


This will "floor" the quotient.


### `divAwayFromZero(struct FixedPoint.Signed a, struct FixedPoint.Signed b) → struct FixedPoint.Signed` (internal)

Divides one `Signed` by an `Signed` and "ceil's" the quotient, reverting on overflow or division by 0.




### `divAwayFromZero(struct FixedPoint.Signed a, int256 b) → struct FixedPoint.Signed` (internal)

Divides one `Signed` by an unscaled int256 and "ceil's" the quotient, reverting on overflow or division by 0.




### `pow(struct FixedPoint.Signed a, uint256 b) → struct FixedPoint.Signed output` (internal)

Raises an `Signed` to the power of an unscaled uint256, reverting on overflow. E.g., `b=2` squares `a`.


This will "floor" the result.



