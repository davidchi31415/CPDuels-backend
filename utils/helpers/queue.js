class Queue {
	constructor() {
		this.first = 0;
		this.last = 0;
		this.storage = {};
	}

	enqueue(value) {
		this.storage[this.last] = value;
		this.last++;
	}

	dequeue() {
		if (this.last > this.first) {
			var value = this.storage[this.first];
			this.first++;
			return value;
		} else {
			return 0;
		}
	}

	size() {
		return this.last - this.first;
	}
}

export default Queue;
