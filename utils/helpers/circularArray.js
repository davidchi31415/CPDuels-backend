class circularArray {
	pointerIndex = 0;

	constructor(
		array = [
			["a", "b"],
			["c", "d"],
		]
	) {
		this.arr = array;
	}

	getCurAndUpdate() {
		let res = this.arr[this.pointerIndex];
		this.updatePointer();
		return res;
	}

	updatePointer() {
		this.pointerIndex =
			(((this.pointerIndex + 1) % this.arr.length) + this.arr.length) %
			this.arr.length;
	}
}

export default circularArray;
