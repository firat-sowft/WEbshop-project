let cartModal;
let selectedProduct = null;
let productDetailModal;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        if (!checkToken()) return;
        
        await loadProducts();
        await loadCart();
        
        cartModal = new bootstrap.Modal(document.getElementById('cartModal'));
        productDetailModal = new bootstrap.Modal(document.getElementById('productDetailModal'));
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Bir hata oluştu', 'error');
    }
});

async function loadProducts() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/products', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const products = await response.json();
        console.log('API Response:', products);
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Ürünler yüklenirken bir hata oluştu', 'error');
    }
}

function checkAuth() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');

    if (!token || !userRole) {
        window.location.replace('/login.html');
        return;
    }

    if (userRole !== 'Customer') {
        alert('Bu sayfaya erişim yetkiniz yok!');
        window.location.replace('/login.html');
        return;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.replace('/login.html');
}

async function loadCart() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/cart', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cart = await response.json();
        updateCartDisplay(cart);
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

function updateCartDisplay(cart) {
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartTotal = document.getElementById('cartTotal');
    const cartCount = document.getElementById('cartCount');

    if (!cart || cart.items.length === 0) {
        cartItems.innerHTML = '';
        emptyCart.style.display = 'block';
        cartTotal.textContent = '0.00 ₺';
        cartCount.textContent = '0';
        return;
    }

    emptyCart.style.display = 'none';
    cartCount.textContent = cart.items.length.toString();
    cartTotal.textContent = `${cart.totalAmount.toFixed(2)} ₺`;

    cartItems.innerHTML = cart.items.map(item => `
        <div class="d-flex align-items-center mb-3 border-bottom pb-3">
            <img src="${item.imageUrl || '/images/no-image.png'}" 
                 alt="${item.productName}"
                 style="width: 64px; height: 64px; object-fit: cover;"
                 class="me-3">
            <div class="flex-grow-1">
                <h6 class="mb-0">${item.productName}</h6>
                <small class="text-muted">${item.price} ₺</small>
            </div>
            <div class="d-flex align-items-center">
                <button class="btn btn-sm btn-outline-secondary me-2" 
                        onclick="updateQuantity('${item.productId}', ${item.quantity - 1})"
                        ${item.quantity <= 1 ? 'disabled' : ''}>
                    <i class="bi bi-dash"></i>
                </button>
                <span class="mx-2">${item.quantity}</span>
                <button class="btn btn-sm btn-outline-secondary ms-2" 
                        onclick="updateQuantity('${item.productId}', ${item.quantity + 1})">
                    <i class="bi bi-plus"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger ms-3" 
                        onclick="removeFromCart('${item.productId}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function addToCart() {
    try {
        const sizeSelect = document.getElementById('sizeSelect');
        const quantityInput = document.getElementById('quantityInput');
        
        if (!sizeSelect.value) {
            showToast('Lütfen bir numara seçin', 'warning');
            return;
        }
        
        const quantity = parseInt(quantityInput.value);
        if (quantity < 1) {
            showToast('Geçerli bir adet giriniz', 'warning');
            return;
        }
        
        // Seçilen numaranın stok kontrolü
        const selectedSize = selectedProduct.sizes.find(s => s.size === parseInt(sizeSelect.value));
        if (!selectedSize) {
            showToast('Geçersiz numara seçimi', 'warning');
            return;
        }
        
        if (quantity > selectedSize.stock) {
            showToast('Yetersiz stok', 'warning');
            return;
        }

        console.log('Adding to cart:', {
            productId: selectedProduct.id,
            size: parseInt(sizeSelect.value),
            quantity: quantity
        });
        
        await addItemToCart(selectedProduct.id, parseInt(sizeSelect.value), quantity);
        
        productDetailModal.hide();
        showToast('Ürün sepete eklendi', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message, 'danger');
    }
}

async function addItemToCart(productId, size, quantity) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.replace('/login.html');
            throw new Error('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        }

        console.log('Token:', token); // Debug için

        const response = await fetch('/api/cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.trim()}` // token'ı temizle
            },
            body: JSON.stringify({
                productId: productId,
                size: size,
                quantity: quantity
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.clear(); // Tüm storage'ı temizle
                window.location.replace('/login.html');
                throw new Error('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
            }

            const errorData = await response.json();
            throw new Error(errorData.message || 'Ürün sepete eklenirken bir hata oluştu');
        }

        await loadCart();
        showToast('Ürün sepete eklendi', 'success');
    } catch (error) {
        console.error('Error adding item to cart:', error);
        throw error;
    }
}

async function updateQuantity(productId, quantity) {
    if (quantity < 1) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/cart/items/${productId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ quantity: quantity })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await loadCart();
    } catch (error) {
        console.error('Error updating quantity:', error);
        showToast('Miktar güncellenirken bir hata oluştu', 'error');
    }
}

async function removeFromCart(productId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/cart/items/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await loadCart();
        showToast('Ürün sepetten kaldırıldı');
    } catch (error) {
        console.error('Error removing from cart:', error);
        showToast('Ürün sepetten kaldırılırken bir hata oluştu', 'error');
    }
}

async function clearCart() {
    if (!confirm('Sepeti temizlemek istediğinize emin misiniz?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/cart', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await loadCart();
        showToast('Sepet temizlendi');
    } catch (error) {
        console.error('Error clearing cart:', error);
        showToast('Sepet temizlenirken bir hata oluştu', 'error');
    }
}

function showCart() {
    cartModal.show();
}

// Toast container'ı sayfa yüklendiğinde oluştur
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('toastContainer')) {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(container);
    }
});

function showToast(message, type = 'success') {
    const toastId = 'toast_' + new Date().getTime();
    const bgColor = type === 'success' ? 'bg-success' : 
                    type === 'error' ? 'bg-danger' : 
                    type === 'info' ? 'bg-info' : 'bg-primary';

    const toastHtml = `
        <div id="${toastId}" class="toast ${bgColor} text-white" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header ${bgColor} text-white">
                <strong class="me-auto">Bildirim</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

    const container = document.getElementById('toastContainer');
    container.insertAdjacentHTML('beforeend', toastHtml);

    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        delay: 3000,
        autohide: true
    });

    toast.show();

    // Toast kapandığında DOM'dan kaldır
    toastElement.addEventListener('hidden.bs.toast', function () {
        toastElement.remove();
    });
}

async function checkout() {
    try {
        console.log('Checkout function started');

        const shippingAddress = document.getElementById('shippingAddress').value;
        const paymentMethod = document.getElementById('paymentMethod').value;

        console.log('Form values:', { shippingAddress, paymentMethod });

        if (!shippingAddress || !paymentMethod) {
            showToast('Lütfen tüm alanları doldurun', 'error');
            return;
        }

        // Sepet boş mu kontrol et
        const cartItems = document.getElementById('cartItems');
        if (!cartItems || cartItems.children.length === 0) {
            showToast('Sepetiniz boş. Sipariş oluşturulamadı!', 'error');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.', 'error');
            window.location.href = '/login.html';
            return;
        }

        console.log('Making API request with token:', token);
        showToast('Siparişiniz işleniyor...', 'info');

        const response = await fetch('/api/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                shippingAddress,
                paymentMethod
            })
        });

        console.log('API Response status:', response.status);
        const responseData = await response.json();
        console.log('API Response data:', responseData);

        if (!response.ok) {
            throw new Error(responseData.message || 'Sipariş oluşturulurken bir hata oluştu');
        }

        showToast('Siparişiniz başarıyla oluşturuldu! Teşekkür ederiz.', 'success');

        // Modal'ı kapat
        const cartModal = bootstrap.Modal.getInstance(document.getElementById('cartModal'));
        cartModal.hide();

        // Formu sıfırla
        document.getElementById('shippingAddress').value = '';
        document.getElementById('paymentMethod').value = '';
        document.getElementById('orderForm').style.display = 'none';
        document.getElementById('checkoutButton').style.display = 'inline-block';
        document.getElementById('confirmOrderButton').style.display = 'none';

        await loadCart();
    } catch (error) {
        console.error('Checkout error:', error);
        showToast(error.message || 'Sipariş oluşturulurken bir hata oluştu', 'error');
    }
}

function showOrderForm() {
    console.log('Showing order form'); // Debug log
    const orderForm = document.getElementById('orderForm');
    const checkoutButton = document.getElementById('checkoutButton');
    const confirmOrderButton = document.getElementById('confirmOrderButton');

    if (!orderForm || !checkoutButton || !confirmOrderButton) {
        console.error('Required elements not found!');
        return;
    }

    orderForm.style.display = 'block';
    checkoutButton.style.display = 'none';
    confirmOrderButton.style.display = 'inline-block';
}

function displayProducts(products) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    products.forEach(product => {
        // API'den gelen veriyi kontrol et
        console.log('Product:', product);
        console.log('Sizes:', product.sizes);

        // Stok kontrolü
        const totalStock = product.sizes.reduce((sum, size) => sum + size.stock, 0);
        console.log('Total Stock:', totalStock);

        const availableSizes = product.sizes
            .filter(size => size.stock > 0)
            .map(size => size.size)
            .sort((a, b) => a - b);
        console.log('Available Sizes:', availableSizes);

        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <div class="card product-card" onclick="showProductDetail(${JSON.stringify(product).replace(/"/g, '&quot;')})">
                <div class="product-image-container">
                    <img src="${product.imageUrl || '/images/no-image.png'}" 
                         class="card-img-top" 
                         alt="${product.name}">
                    <div class="hover-overlay">
                        <div class="hover-text">
                            ${totalStock > 0 ? '<i class="bi bi-eye"></i> Numara Seç' : 'Stokta Yok'}
                        </div>
                    </div>
                </div>
                <div class="card-body text-center">
                    <h6 class="brand-text mb-2">${product.brand || 'Marka Belirtilmemiş'}</h6>
                    <h5 class="price-text">${product.price.toFixed(2)} ₺</h5>
                    <div class="available-sizes small text-muted mt-2">
                        ${totalStock > 0 ? 
                            `<span class="badge bg-success">Stokta Var</span>
                             <br>Mevcut Numaralar: ${availableSizes.join(', ')}` : 
                            '<span class="badge bg-danger">Stokta Yok</span>'
                        }
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

// Mevcut numaraları string olarak döndüren yardımcı fonksiyon
function getAvailableSizes(sizes) {
    return sizes
        .filter(size => size.stock > 0)
        .map(size => size.size)
        .sort((a, b) => a - b)
        .join(', ');
}

function showProductDetail(product) {
    selectedProduct = product;
    
    // Modal içeriğini güncelle
    document.getElementById('modalProductImage').src = product.imageUrl || '/images/no-image.png';
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductDescription').textContent = product.description || '';
    document.getElementById('modalProductPrice').textContent = `${product.price.toFixed(2)} ₺`;
    
    // Beden seçeneklerini güncelle
    const sizeSelect = document.getElementById('sizeSelect');
    sizeSelect.innerHTML = '<option value="">Numara Seçin</option>';
    
    // Stokta olan bedenleri sırala ve ekle
    const availableSizes = product.sizes
        .filter(size => size.stock > 0)
        .sort((a, b) => a.size - b.size);

    if (availableSizes.length === 0) {
        sizeSelect.innerHTML = '<option value="" disabled>Stokta Ürün Bulunmamaktadır</option>';
        document.getElementById('quantityInput').disabled = true;
        document.querySelector('[onclick="addToCart()"]').disabled = true;
        return;
    }

    availableSizes.forEach(size => {
        const option = document.createElement('option');
        option.value = size.size;
        option.textContent = `${size.size} Numara (Stok: ${size.stock})`;
        sizeSelect.appendChild(option);
    });
    
    // Adet input'unu aktif et ve sıfırla
    const quantityInput = document.getElementById('quantityInput');
    quantityInput.disabled = false;
    quantityInput.value = 1;
    quantityInput.max = Math.max(...availableSizes.map(s => s.stock));
    
    // Sepete ekle butonunu aktif et
    document.querySelector('[onclick="addToCart()"]').disabled = false;
    
    // Modalı göster
    productDetailModal.show();
}

// Numara seçildiğinde stok kontrolü
document.getElementById('sizeSelect')?.addEventListener('change', function() {
    const selectedSize = selectedProduct?.sizes.find(s => s.size === parseInt(this.value));
    const quantityInput = document.getElementById('quantityInput');
    
    if (selectedSize) {
        quantityInput.max = selectedSize.stock;
        quantityInput.value = Math.min(quantityInput.value, selectedSize.stock);
    }
});

// Sepet sayısını güncelleme fonksiyonu
function updateCartCount(count) {
    const cartCountElement = document.getElementById('cartCount');
    if (cartCountElement) {
        cartCountElement.textContent = count;
    }
}

// Toast bildirimi gösterme fonksiyonu
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Token kontrolü için yardımcı fonksiyon
function checkToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('/login.html');
        return false;
    }
    return true;
} 