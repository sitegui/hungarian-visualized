function init(costs) {
    let n = costs.length

    // agents = rows
    let rows = []

    // tasks = cols
    let cols = []

    for (let i = 0; i < n; i++) {
        rows[i] = {
            i,
            str: String.fromCharCode(65 + i),
            label: 0,
            // A reference to the col currently matched to this row
            matched_col: null,
            visited: false,
            // If the algorithm is actively here how
            head: false
        }
    }

    for (let j = 0; j < n; j++) {
        cols[j] = {
            j,
            str: String.fromCharCode(97 + j),
            label: 0,
            // A reference to the row currently matched to this col
            matched_row: null,
            min_delta: null,
            // A reference to the row that produces the min_delta
            min_delta_row: null,
            // A reference to the parent row to for the augmenting path from this col
            path: null,
            // If the path is actually part of the augmenting path
            is_path_real: null,
            // If the algorithm is actively here how
            head: false
        }
    }

    return new Vue({
        el: '#hungarian',
        data: {
            n,
            costs,
            rows,
            cols,
            temp_best_delta_col: null,
            // The row and col that contains the current min delta, and its value
            min_delta_row: null,
            min_delta_col: null,
            min_delta: Infinity,
            // drawing size constants
            d: {
                // node radius
                R: 15,
                // rows' x
                X1: 100,
                // cols' x
                X2: 300,
                // node margin
                YM: 10
            }
        },
        methods: { reduce, greedy, prepare_iteration, step_iteration }
    })
}

function reduce() {
    for (let row of this.rows) {
        row.label = Infinity
        for (let col of this.cols) {
            row.label = Math.min(row.label, this.costs[row.i][col.j])
        }
    }

    for (let col of this.cols) {
        col.label = Infinity
        for (let row of this.rows) {
            col.label = Math.min(col.label, this.costs[row.i][col.j] - row.label)
        }
    }
}

function greedy() {
    for (let row of this.rows) {
        for (let col of this.cols) {
            if (col.matched_row === null && this.costs[row.i][col.j] === row.label + col.label) {
                row.matched_col = col
                col.matched_row = row
                break
            }
        }
    }
}

function prepare_iteration() {
    let unmatched_row = this.rows.find(row => row.matched_col === null)

    for (let row of this.rows) {
        row.visited = row === unmatched_row
    }
    unmatched_row.head = true

    this.min_delta = Infinity
    this.min_delta_row = unmatched_row
    this.min_delta_col = null
    for (let col of this.cols) {
        col.min_delta = this.costs[unmatched_row.i][col.j] - unmatched_row.label - col.label
        col.min_delta_row = unmatched_row
        col.path = null

        if (col.min_delta < this.min_delta) {
            this.min_delta = col.min_delta
            this.min_delta_col = col
        }
    }
}

function step_iteration() {
    if (this.temp_best_delta_col === null) {
        // Sub step 1
        // Find the col and row that have the least delta, but ignore cols that are included in the path already

        if (this.min_delta !== 0) {
            for (let row of this.rows) {
                if (row.visited) {
                    row.label += this.min_delta
                }
            }
            for (let col of this.cols) {
                if (col.path === null) {
                    col.min_delta -= this.min_delta
                } else {
                    col.label -= this.min_delta
                }
            }
            this.min_delta = 0
        }

        // Add to path
        this.min_delta_col.path = this.min_delta_row

        // Update head
        for (let row of this.rows) {
            row.head = false
        }
        this.min_delta_col.head = true

        // Update real augmenting path
        for (let col of this.cols) {
            col.is_path_real = false
        }
        let col = this.min_delta_col
        while (col) {
            col.is_path_real = true
            col = col.path.matched_col
        }

        this.temp_best_delta_col = this.min_delta_col
    } else {
        // Sub step 2

        this.temp_best_delta_col = null

        if (this.min_delta_col.matched_row === null) {
            // Augmenting path found
            let col = this.min_delta_col
            let parent_row = col.path
            while (true) {
                col.matched_row = parent_row
                let temp = parent_row.matched_col
                parent_row.matched_col = col
                if (temp === null) {
                    break
                }
                col = temp
                parent_row = col.path
            }

            // Update head
            for (let col of this.cols) {
                col.head = false
            }
        } else {
            // Update deltas
            let matched_row = this.min_delta_col.matched_row
            matched_row.visited = true

            this.min_delta = Infinity
            for (let col of this.cols) {
                if (col.path === null) {
                    let new_delta = this.costs[matched_row.i][col.j] - matched_row.label - col.label
                    if (new_delta < col.min_delta) {
                        col.min_delta = new_delta
                        col.min_delta_row = matched_row
                    }
                    if (new_delta < this.min_delta) {
                        this.min_delta = new_delta
                        this.min_delta_row = matched_row
                        this.min_delta_col = col
                    }
                }
            }

            // Update head
            for (let col of this.cols) {
                col.head = false
            }
            matched_row.head = true
        }
    }
}

// let hungarian = init([
//     [3, 1, 4, 1, 5],
//     [9, 2, 6, 5, 3],
//     [5, 8, 9, 7, 9],
//     [3, 2, 3, 8, 4],
//     [6, 2, 6, 4, 3]
// ])

let hungarian = init([
    [5, 6, 7, 4, 8, 4, 9],
    [2, 6, 6, 9, 0, 4, 2],
    [6, 5, 2, 4, 0, 7, 6],
    [1, 8, 2, 9, 1, 8, 8],
    [0, 3, 8, 9, 4, 6, 8],
    [6, 5, 7, 8, 2, 8, 7],
    [8, 9, 3, 2, 4, 6, 8]
])

// let n = 5
// let costs = []
// for (let i = 0; i < n; i++) {
//     costs.push([])
//     for (let j = 0; j < n; j++) {
//         costs[i][j] = i * j
//     }
// }
// let hungarian = init(costs)

hungarian.reduce()
hungarian.greedy()
hungarian.prepare_iteration()