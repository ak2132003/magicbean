// ==UserScript==
// @name         MagicBean & MyOrders Combined
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  A combined and enhanced script for MagicBean and MyOrders with user authorization via Supabase.
// @author       Ahmed Khaled
// @match        *.centurygames.com/*
// @grant        unsafeWindow
// @require      https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
// ==/UserScript==

(function () {
  'use strict';

  // Supabase Configuration
  const SUPABASE_URL = 'https://wuauxagghhzqrxgotcqo.supabase.co'; // Replace with your Supabase URL
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1YXV4YWdnaGh6cXJ4Z290Y3FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NjU3NzYsImV4cCI6MjA2ODA0MTc3Nn0.W7Ayyfdh3qmrfzw_F5t35umQZRIdmqKENNdk3HYcNVE'; // Replace with your Supabase Anon Key

  const { createClient } = supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let userAccessToken, userName;

  // دالة لتحميل الجيران المحصدين من localStorage
  function loadHarvestedFriends() {
    try {
      const stored = localStorage.getItem('harvestedFriends');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      console.error('Error loading harvested friends:', e);
      return new Set();
    }
  }

  // دالة لحفظ الجيران المحصدين في localStorage
  function saveHarvestedFriends(harvestedFriends) {
    try {
      localStorage.setItem('harvestedFriends', JSON.stringify(Array.from(harvestedFriends)));
    } catch (e) {
      console.error('Error saving harvested friends:', e);
    }
  }

  // دالة لمسح الجيران المحصدين (للاستخدام عند الحاجة)
  function clearHarvestedFriends() {
    try {
      localStorage.removeItem('harvestedFriends');
    } catch (e) {
      console.error('Error clearing harvested friends:', e);
    }
  }

  function playSound(url) {
    const audio = new Audio(url);
    audio.play();
  }

  function playLoopedSound(url) {
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0;
    audio.play();
  }

  async function fetchUserData() {
    try {
      userAccessToken = await unsafeWindow.HV.get_access_token();
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${userAccessToken}`
      );
      const userData = await response.json();
      userName = userData.name;
    } catch (error) {
      console.error('Error fetching user data:', error);
      alert('حدث خطأ أثناء جلب بيانات المستخدم.');
      throw error;
    }
  }

  async function checkUserWhitelist() {
    const snsid = document.querySelector('#user-snsid')?.textContent?.match(/\d+/)?.[0] ||
      document.querySelector('.footer-snsid')?.textContent?.match(/\d+/)?.[0] || 'unknown';

    if (snsid === 'unknown') {
      alert('تعذر تحديد هوية المستخدم. يرجى المحاولة مرة أخرى.');
      return false;
    }

    try {
      const { data, error } = await supabaseClient
        .from('whitelisted_users')
        .select('snsid')
        .eq('snsid', snsid);

      if (error) {
        console.error('Supabase query error:', error);
        alert('حدث خطأ في التحقق من المستخدم. يرجى التواصل مع الدعم الفني.');
        return false;
      }

      if (!data || data.length === 0) {
        alert('غير مسموح لك باستخدام الاسكريبت. اطلب إذن الوصول من المطور - Ahmed Khaled');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error with Supabase client:', error);
      alert('حدث خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة لاحقًا.');
      return false;
    }
  }

  async function magicBeanHandler() {
    const confirmMessage = confirm('إنهاء الخمسة طلبات اليومية للفاصوليا السحرية\nتأكيد العملية ؟');
    if (!confirmMessage) return;

    playSound('');
    const counterDiv = unsafeWindow.document.createElement('div');
    counterDiv.innerHTML = "<span id='counterText'></span><br><button id='resetHarvested'>إعادة تعيين الجيران المحصدين</button>";
    counterDiv.style.cssText = 'position: absolute; top: 10px; right: 10px; background: #2c3e50; color: white; padding: 10px; border-radius: 5px; font-family: "Arial Black", Gadget, sans-serif; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 1000;';
    document.body.appendChild(counterDiv);

    // إضافة حدث لإعادة تعيين الجيران المحصدين
    document.getElementById('resetHarvested').addEventListener('click', function() {
      clearHarvestedFriends();
      alert('تم إعادة تعيين قائمة الجيران المحصدين');
    });

    const counterText = document.getElementById('counterText');
    counterText.innerText = 'جارى إنهاء طلبات مهمة الفاصوليا - يرجى الانتظار';

    let friendHarvests = 99999;
    let harvestedFriends = loadHarvestedFriends(); // تحميل الجيران المحصدين من التخزين
    let ordersData, tasksToComplete;
    let completedOrdersCount = 0;
    let currentTaskIndex = 0;

    async function loadMagicBeans() {
      const response = await unsafeWindow.NetUtils.request(unsafeWindow.HttpConst.MAGIC_BEAN_LOAD);
      ordersData = response.magicBean.freeOrders;
      tasksToComplete = ordersData.filter((order) => order.quest.pos === 29 || order.quest.pos === 34)
                                  .flatMap((order) => order.quest.tasks.map((task) => ({
                                    task,
                                    task_filter: task.filter,
                                    order_Id: order.orderId,
                                  })));
    }

    async function pickOrder() {
      const payload = {
        orderId: tasksToComplete[currentTaskIndex].order_Id,
        useRC: true,
        rc: 6,
      };
      await unsafeWindow.NetUtils.request('Guild/MagicBean/PickOrder', payload);
    }

    async function harvestFromFriends() {
      if (friendHarvests <= 0) {
        unsafeWindow.ConfirmView.Show('تم استهلاك جميع مرات الحصاد الممكنة');
        return;
      }

      let itemId = tasksToComplete[currentTaskIndex].task_filter;
      if (isNaN(itemId) || itemId <= 0) {
        alert('أدخل عدد صحيح');
        return;
      }

      itemId = parseInt(itemId);
      const allFriends = await unsafeWindow.GF.friendsController.model.backendFriendsData.neighbors;
      const harvestableFriends = new Set();

      allFriends.forEach((friend) => {
        if (!harvestedFriends.has(friend.uid)) {
          const user = unsafeWindow.GF.friendsController.model.getUser(friend.uid);
          if (user.fertilizer_times === 0) {
            harvestableFriends.add(friend.uid);
          }
        }
      });

      if (friendHarvests === 99999) {
        friendHarvests = harvestableFriends.size;
      }

      const maxHarvests = 55;
      if (harvestableFriends.size < maxHarvests) {
        alert('أدخل عدد صحيح');
        return;
      }

      let harvestedCount = 0;
      const friendsIterator = harvestableFriends.values();

      for (const friendId of friendsIterator) {
        if (harvestedCount === maxHarvests || friendHarvests <= 0) {
          break;
        }

        const friendUser = unsafeWindow.GF.friendsController.model.getUser(friendId);
        if (friendUser.fertilizer_times <= 0) {
          harvestedCount++;
          for (let i = 0; i <= 12; i++) {
            const payload = {
              friend_id: friendId,
              friendName: 'Admin',
              itemid: itemId,
              cur_sceneid: 0,
            };
            await unsafeWindow.GF.loginController.loginProxy.send('friend_collect.save_data', payload);
          }
          await unsafeWindow.NetUtils.request('friend_collect', {});
          harvestedFriends.add(friendId);
        }
      }

      // حفظ الجيران المحصدين بعد كل عملية حصاد
      saveHarvestedFriends(harvestedFriends);

      if (harvestedCount > 0 && harvestedCount < 154) {
        completedOrdersCount++;
        counterText.innerText = `تم إنهاء ${completedOrdersCount} من الطلبات - Ahmed Khaled`;
      }

      friendHarvests -= harvestedCount;
      if (friendHarvests <= 0) {
        friendHarvests = 0;
      }
    }

    await loadMagicBeans();
    await pickOrder();
    await harvestFromFriends();
    await loadMagicBeans();

    for (let i = 0; i < 4; i++) {
      currentTaskIndex = 1;
      await pickOrder();
      await harvestFromFriends();
      await loadMagicBeans();
    }

    playSound('');
    setTimeout(() => counterDiv.remove(), 5000);
  }

  async function myOrdersHandler() {
    const confirmMessage = confirm('إنهاء الخمسة طلبات اليومية للفاصوليا السحرية\nتأكيد العملية ؟');
    if (!confirmMessage) return;

    playSound('');
    const counterDiv = unsafeWindow.document.createElement('div');
    counterDiv.innerHTML = "<span id='counterText'></span><br><button id='resetHarvested'>إعادة تعيين الجيران المحصدين</button>";
    counterDiv.style.cssText = 'position: absolute; top: 10px; right: 10px; background: #2c3e50; color: white; padding: 10px; border-radius: 5px; font-family: "Arial Black", Gadget, sans-serif; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 1000;';
    document.body.appendChild(counterDiv);

    // إضافة حدث لإعادة تعيين الجيران المحصدين
    document.getElementById('resetHarvested').addEventListener('click', function() {
      clearHarvestedFriends();
      alert('تم إعادة تعيين قائمة الجيران المحصدين');
    });

    const counterText = document.getElementById('counterText');
    counterText.innerText = 'جارى إنهاء طلبات مهمة الفاصوليا - يرجى الانتظار';

    let friendHarvests = 99999;
    let harvestedFriends = loadHarvestedFriends(); // تحميل الجيران المحصدين من التخزين
    let ordersData, myOrders, tasksToComplete;
    let completedOrdersCount = 0;
    let currentTaskIndex = 0;
    let orderTotal;

    async function loadMagicBeans() {
      const response = await unsafeWindow.NetUtils.request(unsafeWindow.HttpConst.MAGIC_BEAN_LOAD);
      myOrders = response.magicBean.myOrders;
      tasksToComplete = myOrders.flatMap((order) =>
        order.quest.tasks.map((task) => ({
          task,
          task_filter: task.filter,
          order_Id: order.orderId,
          order_Total: task.total,
        }))
      );
      currentTaskIndex = tasksToComplete.length - 1;
      orderTotal = tasksToComplete[currentTaskIndex].order_Total;
    }

    async function harvestFromFriends() {
      if (friendHarvests <= 0) {
        unsafeWindow.ConfirmView.Show('تم استهلاك جميع مرات الحصاد الممكنة');
        return;
      }

      let itemId = tasksToComplete[currentTaskIndex].task_filter;
      if (isNaN(itemId) || itemId <= 0) {
        alert('أدخل عدد صحيح');
        return;
      }

      itemId = parseInt(itemId);
      const allFriends = await unsafeWindow.GF.friendsController.model.backendFriendsData.neighbors;
      const harvestableFriends = new Set();

      allFriends.forEach((friend) => {
        if (!harvestedFriends.has(friend.uid)) {
          const user = unsafeWindow.GF.friendsController.model.getUser(friend.uid);
          if (user.fertilizer_times === 0) {
            harvestableFriends.add(friend.uid);
          }
        }
      });

      if (friendHarvests === 99999) {
        friendHarvests = harvestableFriends.size;
      }

      const maxHarvests = Math.floor(orderTotal / 5) + 2;
      if (isNaN(maxHarvests) || maxHarvests <= 0 || maxHarvests > friendHarvests) {
        alert('أدخل عدد صحيح');
        return;
      }

      let harvestedCount = 0;
      const friendsIterator = harvestableFriends.values();

      for (const friendId of friendsIterator) {
        if (harvestedCount === maxHarvests || friendHarvests <= 0) {
          break;
        }

        const friendUser = unsafeWindow.GF.friendsController.model.getUser(friendId);
        if (friendUser.fertilizer_times <= 0) {
          harvestedCount++;
          for (let i = 0; i <= 12; i++) {
            const payload = {
              friend_id: friendId,
              friendName: 'Admin',
              itemid: itemId,
              cur_sceneid: 0,
            };
            await unsafeWindow.GF.loginController.loginProxy.send('friend_collect.save_data', payload);
          }
          await unsafeWindow.NetUtils.request('friend_collect', {});
          harvestedFriends.add(friendId);
        }
      }

      // حفظ الجيران المحصدين بعد كل عملية حصاد
      saveHarvestedFriends(harvestedFriends);

      if (harvestedCount > 0 && harvestedCount < 154) {
        completedOrdersCount++;
        counterText.innerText = `تم إنهاء ${completedOrdersCount} من الطلبات - Ahmed Khaled`;
      }

      friendHarvests -= harvestedCount;
      if (friendHarvests <= 0) {
        friendHarvests = 0;
      }
    }

    await loadMagicBeans();
    await harvestFromFriends();

    playSound('');
    setTimeout(() => counterDiv.remove(), 5000);
  }

  function showActionMenu() {
    const action = prompt('اختر الوظيفة:\n1. الخمسة التلقائية\n2. الطلب الحالي');

    switch (action) {
      case '1':
        magicBeanHandler();
        break;
      case '2':
        myOrdersHandler();
        break;
      default:
        alert('اختيار غير صالح. يرجى الاختيار بين 1 أو 2.');
        break;
    }
  }

  const actionButton = unsafeWindow.document.createElement('BUTTON');
  actionButton.innerHTML = 'MagicBean';
  actionButton.onclick = async () => {
    playSound('');
    playLoopedSound('');
    const isWhitelisted = await checkUserWhitelist();
    if (isWhitelisted) {
      await fetchUserData();
      showActionMenu();
    }
  };

  actionButton.style.cssText =
    'display: inline-block; position: relative; top: 0px; width: auto; background: linear-gradient(135deg, #2c3e50, #34495e); color: #fff; padding: 10px 15px; margin: 10px; font-size: 16px; font-weight: bold; border-radius: 8px; border: none; cursor: pointer; transition: all 0.3s ease 0s; font-family: "Arial Black", Gadget, sans-serif; box-shadow: 0 4px 8px rgba(0,0,0,0.2);';

  document.body.appendChild(actionButton);
})();
